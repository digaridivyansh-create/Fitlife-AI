from pathlib import Path
import tempfile

import cv2
import mediapipe as mp
import numpy as np

from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

from app.form_analysis.service import MODEL_PATH, POSE_CONNECTION_CONFIDENCE
from app.form_analysis.service import PoseAnalysisError


MAX_VIDEO_DURATION_SECONDS = 60
DEFAULT_SAMPLE_INTERVAL_SECONDS = 0.2


def create_video_pose_landmarker():
    """Create a MediaPipe landmarker configured for sequential video frames."""
    if not MODEL_PATH.is_file():
        raise PoseAnalysisError("Pose Landmarker model file is missing.")

    options = vision.PoseLandmarkerOptions(
        base_options=mp_python.BaseOptions(
            model_asset_path=str(MODEL_PATH)
        ),
        running_mode=vision.RunningMode.VIDEO,
        num_poses=1,
        min_pose_detection_confidence=POSE_CONNECTION_CONFIDENCE,
        min_pose_presence_confidence=POSE_CONNECTION_CONFIDENCE,
        min_tracking_confidence=POSE_CONNECTION_CONFIDENCE,
    )

    try:
        return vision.PoseLandmarker.create_from_options(options)
    except Exception as error:
        raise PoseAnalysisError(
            "Could not initialize the video pose detection model."
        ) from error


def _serialize_landmarks(landmarks):
    serialized = []

    for index, point in enumerate(landmarks):
        x = float(point.x)
        y = float(point.y)
        z = float(point.z)
        visibility = float(point.visibility)

        finite_coordinates = bool(
            np.isfinite(x)
            and np.isfinite(y)
            and np.isfinite(z)
            and np.isfinite(visibility)
        )

        in_frame = bool(
            finite_coordinates
            and 0.0 <= x <= 1.0
            and 0.0 <= y <= 1.0
        )

        usable = bool(
            in_frame
            and visibility >= POSE_CONNECTION_CONFIDENCE
        )

        serialized.append({
            "index": index,
            "x": x,
            "y": y,
            "z": z,
            "visibility": visibility,
            "in_frame": in_frame,
            "usable": usable,
        })

    return serialized


def analyze_video_bytes(
    video_bytes: bytes,
    sample_interval_seconds: float = DEFAULT_SAMPLE_INTERVAL_SECONDS,
) -> dict:
    """Extract pose landmarks from sampled frames in an uploaded video."""

    if not video_bytes:
        raise PoseAnalysisError("Video data is empty.")

    if not 0.05 <= sample_interval_seconds <= 2.0:
        raise PoseAnalysisError("Invalid video sampling interval.")

    temporary_path = None
    capture = None
    landmarker = None

    try:
        with tempfile.NamedTemporaryFile(
            suffix=".mp4",
            delete=False,
        ) as temporary_file:
            temporary_file.write(video_bytes)
            temporary_path = Path(temporary_file.name)

        capture = cv2.VideoCapture(str(temporary_path))

        if not capture.isOpened():
            raise PoseAnalysisError("Uploaded video could not be opened.")

        fps = float(capture.get(cv2.CAP_PROP_FPS))
        frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))

        if not np.isfinite(fps) or fps <= 0 or frame_count <= 0:
            raise PoseAnalysisError("Video metadata is invalid.")

        duration = frame_count / fps

        if duration > MAX_VIDEO_DURATION_SECONDS:
            raise PoseAnalysisError(
                "Video exceeds the 60-second processing limit."
            )

        landmarker = create_video_pose_landmarker()

        sample_every_n_frames = max(
            1,
            round(fps * sample_interval_seconds),
        )

        frames = []
        gemini_frames = []

        sampled_frame_count = (
            frame_count + sample_every_n_frames - 1
        ) // sample_every_n_frames

        target_sample_indices = {
            round(position * (sampled_frame_count - 1) / 5)
            for position in range(6)
        }

        frame_index = 0
        sample_index = 0

        while True:
            success, bgr_frame = capture.read()

            if not success:
                break

            if frame_index % sample_every_n_frames == 0:
                height, width = bgr_frame.shape[:2]
                scale = min(1.0, 1280 / max(height, width))

                if scale < 1.0:
                    bgr_frame = cv2.resize(
                        bgr_frame,
                        (
                            round(width * scale),
                            round(height * scale),
                        ),
                        interpolation=cv2.INTER_AREA,
                    )

                rgb_frame = cv2.cvtColor(
                    bgr_frame,
                    cv2.COLOR_BGR2RGB,
                )

                mp_frame = mp.Image(
                    image_format=mp.ImageFormat.SRGB,
                    data=np.ascontiguousarray(rgb_frame),
                )

                timestamp_ms = round(frame_index * 1000 / fps)

                result = landmarker.detect_for_video(
                    mp_frame,
                    timestamp_ms,
                )

                detected_landmarks = None

                if result.pose_landmarks:
                    detected_landmarks = _serialize_landmarks(
                        result.pose_landmarks[0]
                    )

                frames.append({
                    "timestamp_ms": timestamp_ms,
                    "frame_index": frame_index,
                    "landmarks": detected_landmarks,
                })

                if sample_index in target_sample_indices:
                    encoded, jpeg_buffer = cv2.imencode(
                        ".jpg",
                        bgr_frame,
                        [cv2.IMWRITE_JPEG_QUALITY, 75],
                    )

                    if encoded:
                        gemini_frames.append({
                            "timestamp_ms": timestamp_ms,
                            "image_bytes": jpeg_buffer.tobytes(),
                        })

                sample_index += 1

            frame_index += 1

        if not frames:
            raise PoseAnalysisError("No video frames could be analyzed.")

        detected_count = sum(
            frame["landmarks"] is not None
            for frame in frames
        )

        if detected_count == 0:
            raise PoseAnalysisError("No person pose was detected in the video.")

        return {
            "duration_seconds": round(duration, 2),
            "fps": round(fps, 2),
            "total_video_frames": frame_count,
            "frames_analyzed": len(frames),
            "frames_with_pose": detected_count,
            "frames": frames,
            "gemini_frames": gemini_frames,
        }

    except PoseAnalysisError:
        raise

    except Exception as error:
        raise PoseAnalysisError(
            "Video pose analysis could not be completed."
        ) from error

    finally:
        if landmarker is not None:
            landmarker.close()

        if capture is not None:
            capture.release()

        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)
