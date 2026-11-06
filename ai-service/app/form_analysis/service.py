from pathlib import Path
import math

import cv2
import mediapipe as mp
import numpy as np

from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision


MODEL_PATH = (
    Path(__file__).parent
    / "models"
    / "pose_landmarker_lite.task"
)

POSE_CONNECTION_CONFIDENCE = 0.5


class PoseAnalysisError(Exception):
    """Raised when pose detection cannot be completed."""


def calculate_angle(point_a, point_b, point_c) -> float:
    """Calculate the angle ABC in degrees."""
    a = np.array(point_a, dtype=float)
    b = np.array(point_b, dtype=float)
    c = np.array(point_c, dtype=float)

    vector_a = a - b
    vector_c = c - b

    norm_a = np.linalg.norm(vector_a)
    norm_c = np.linalg.norm(vector_c)

    if norm_a == 0 or norm_c == 0:
        raise PoseAnalysisError(
            "Cannot calculate an angle from identical points."
        )

    cosine = np.dot(vector_a, vector_c) / (norm_a * norm_c)
    cosine = np.clip(cosine, -1.0, 1.0)

    return float(math.degrees(math.acos(cosine)))


def create_pose_landmarker():
    """Create a MediaPipe Pose Landmarker for image inference."""
    if not MODEL_PATH.is_file():
        raise PoseAnalysisError("Pose Landmarker model file is missing.")

    options = vision.PoseLandmarkerOptions(
        base_options=mp_python.BaseOptions(
            model_asset_path=str(MODEL_PATH)
        ),
        running_mode=vision.RunningMode.IMAGE,
        num_poses=1,
        min_pose_detection_confidence=POSE_CONNECTION_CONFIDENCE,
        min_pose_presence_confidence=POSE_CONNECTION_CONFIDENCE,
        min_tracking_confidence=POSE_CONNECTION_CONFIDENCE,
    )

    try:
        return vision.PoseLandmarker.create_from_options(options)
    except Exception as error:
        raise PoseAnalysisError(
            "Could not initialize the pose detection model."
        ) from error


def detect_pose_in_image(image_bytes: bytes) -> list[dict]:
    """Detect pose landmarks from one uploaded image."""
    if not image_bytes:
        raise PoseAnalysisError("Image data is empty.")

    image_array = np.frombuffer(image_bytes, dtype=np.uint8)
    bgr_frame = cv2.imdecode(image_array, cv2.IMREAD_COLOR)

    if bgr_frame is None:
        raise PoseAnalysisError("Uploaded file is not a valid image.")

    rgb_frame = cv2.cvtColor(bgr_frame, cv2.COLOR_BGR2RGB)

    frame = mp.Image(
        image_format=mp.ImageFormat.SRGB,
        data=np.ascontiguousarray(rgb_frame),
    )

    landmarker = create_pose_landmarker()

    try:
        result = landmarker.detect(frame)

        if not result.pose_landmarks:
            raise PoseAnalysisError("No person pose was detected.")

        landmarks = result.pose_landmarks[0]

        return [
            {
                "index": index,
                "x": float(point.x),
                "y": float(point.y),
                "z": float(point.z),
                "visibility": float(point.visibility),
            }
            for index, point in enumerate(landmarks)
        ]

    finally:
        landmarker.close()
