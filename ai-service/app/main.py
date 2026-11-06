from datetime import datetime, timezone
import secrets

from fastapi import (
    FastAPI,
    HTTPException,
    Header,
    UploadFile,
    File,
)

from app.workouts.planner import (
    WorkoutPlanRequest,
    WorkoutPlanResponse,
    generate_workout_plan,
)

from app.nutrition.service import (
    analyze_meal,
    NutritionAnalysisError,
)
from app.nutrition.analyzer import FoodImageError

from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "FitLife AI Service"
    app_env: str = "development"
    host: str = "127.0.0.1"
    port: int = 8001
    ai_service_token: str

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()

app = FastAPI(
    title=settings.app_name,
    description="AI service for personalized fitness and nutrition",
    version="1.0.0",
)


MAX_FOOD_IMAGE_BYTES = 10 * 1024 * 1024

ALLOWED_IMAGE_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/avif",
}


class HealthResponse(BaseModel):
    status: str
    service: str
    timestamp: datetime


def verify_ai_service_token(token: str | None) -> None:
    if (
        not token
        or not secrets.compare_digest(
            token,
            settings.ai_service_token,
        )
    ):
        raise HTTPException(
            status_code=401,
            detail="Unauthorized AI service request.",
        )


@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="healthy",
        service=settings.app_name,
        timestamp=datetime.now(timezone.utc),
    )


@app.get("/")
async def root():
    return {
        "message": f"{settings.app_name} is running",
        "environment": settings.app_env,
        "docs": "/docs",
        "health": "/health",
    }


@app.post(
    "/workouts/generate",
    response_model=WorkoutPlanResponse,
    tags=["Workouts"],
)
async def create_workout_plan(
    request: WorkoutPlanRequest,
    x_ai_service_token: str | None = Header(default=None),
):
    verify_ai_service_token(x_ai_service_token)

    try:
        return generate_workout_plan(request)
    except ValueError as error:
        raise HTTPException(
            status_code=422,
            detail=str(error),
        ) from error


@app.post(
    "/food/analyze",
    tags=["Nutrition"],
)
async def analyze_food(
    image: UploadFile | None = File(default=None),
    x_ai_service_token: str | None = Header(default=None),
):
    verify_ai_service_token(x_ai_service_token)

    if image is None:
        raise HTTPException(
            status_code=400,
            detail="An image file is required.",
        )

    content_type = (image.content_type or "").lower()

    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=415,
            detail="Unsupported image type. Upload JPEG, PNG, WEBP, or AVIF.",
        )

    try:
        image_bytes = await image.read(MAX_FOOD_IMAGE_BYTES + 1)

        if not image_bytes:
            raise HTTPException(
                status_code=400,
                detail="Uploaded image is empty.",
            )

        if len(image_bytes) > MAX_FOOD_IMAGE_BYTES:
            raise HTTPException(
                status_code=413,
                detail="Image exceeds the 10 MB upload limit.",
            )

        try:
            return analyze_meal(image_bytes)

        except ValueError as error:
            raise HTTPException(
                status_code=422,
                detail=str(error),
            ) from error

        except (FoodImageError, NutritionAnalysisError):
            raise HTTPException(
                status_code=503,
                detail="Food analysis service is temporarily unavailable.",
            )

    finally:
        await image.close()


from app.nutrition.schemas import FoodConfirmationRequest
from app.nutrition.service import (
    calculate_confirmed_meal,
    NutritionConfirmationError,
)


@app.post(
    "/food/confirm",
    tags=["Nutrition"],
)
async def confirm_food(
    request: FoodConfirmationRequest,
    x_ai_service_token: str | None = Header(default=None),
):
    verify_ai_service_token(x_ai_service_token)

    try:
        confirmed_items = [
            item.model_dump()
            for item in request.items
        ]

        return calculate_confirmed_meal(confirmed_items)

    except NutritionConfirmationError as error:
        raise HTTPException(
            status_code=503,
            detail=str(error),
        ) from error


from app.chatbot.schemas import ChatRequest, ChatResponse
from app.chatbot.service import generate_chat_response, ChatbotError
from starlette.concurrency import run_in_threadpool


@app.post(
    "/chat/respond",
    response_model=ChatResponse,
    tags=["Chatbot"],
)
async def respond_to_chat(
    request: ChatRequest,
    x_ai_service_token: str | None = Header(default=None),
):
    verify_ai_service_token(x_ai_service_token)

    try:
        return await run_in_threadpool(
            generate_chat_response,
            request,
        )

    except ChatbotError:
        raise HTTPException(
            status_code=503,
            detail="Fitness chatbot service is temporarily unavailable.",
        )

from app.progress.schemas import (
    ProgressInsightsRequest,
    ProgressInsightsResponse,
)
from app.progress.service import (
    generate_progress_insights,
    ProgressInsightsError,
)


@app.post(
    "/progress/insights",
    response_model=ProgressInsightsResponse,
    tags=["Progress"],
)
async def create_progress_insights(
    request: ProgressInsightsRequest,
    x_ai_service_token: str | None = Header(default=None),
):
    verify_ai_service_token(x_ai_service_token)

    try:
        return await run_in_threadpool(
            generate_progress_insights,
            request,
        )

    except ProgressInsightsError:
        raise HTTPException(
            status_code=503,
            detail="Progress insights service is temporarily unavailable.",
        )



# Feature 5: Exercise Form Analysis
from app.form_analysis.schemas import FormAnalysisResponse, FormFeedback
from app.form_analysis.video_service import analyze_video_bytes
from app.form_analysis.service import PoseAnalysisError
from app.form_analysis.classifier import classify_exercise_pose
from app.form_analysis.repetition_counter import analyze_repetitions

MAX_FORM_VIDEO_BYTES = 50 * 1024 * 1024


@app.post(
    "/form/analyze-video",
    response_model=FormAnalysisResponse,
    tags=["Exercise Form Analysis"],
)
async def analyze_exercise_video(
    video: UploadFile = File(...),
    x_ai_service_token: str | None = Header(default=None),
):
    verify_ai_service_token(x_ai_service_token)

    try:
        if video.content_type not in {"video/mp4"}:
            raise HTTPException(
                status_code=415,
                detail="Only MP4 video uploads are supported.",
            )

        video_bytes = await video.read(MAX_FORM_VIDEO_BYTES + 1)

        if not video_bytes:
            raise HTTPException(
                status_code=400,
                detail="Uploaded video is empty.",
            )

        if len(video_bytes) > MAX_FORM_VIDEO_BYTES:
            raise HTTPException(
                status_code=413,
                detail="Video exceeds the 50 MB upload limit.",
            )

        analysis = await run_in_threadpool(
            analyze_video_bytes,
            video_bytes,
        )

        classifications = []

        for frame in analysis["frames"]:
            landmarks = frame.get("landmarks")
            if landmarks:
                result = classify_exercise_pose(landmarks)
                if result["exercise"] != "unknown":
                    classifications.append(result["exercise"])

        exercise = "unknown"

        pose_frames = analysis["frames_with_pose"]
        recognition_rate = (
            len(classifications) / pose_frames
            if pose_frames else 0.0
        )

        MIN_RECOGNITION_RATE = 0.20

        if (
            classifications
            and recognition_rate >= MIN_RECOGNITION_RATE
        ):
            from collections import Counter
            exercise = Counter(classifications).most_common(1)[0][0]

        supported_exercises = {"squat", "bicep_curl"}
        counting_mode = "alternating"
        gemini_assessment = None

        # Gemini assesses visual context; MediaPipe remains the repetition counter.
        try:
            from app.form_analysis.video_gemini_service import (
                analyze_exercise_video_frames,
            )

            gemini_frames = analysis.get("gemini_frames", [])
            image_frames = [item["image_bytes"] for item in gemini_frames]

            pose_measurements = {
                "duration_seconds": analysis["duration_seconds"],
                "video_fps": analysis["fps"],
                "frames_analyzed": analysis["frames_analyzed"],
                "frames_with_pose": analysis["frames_with_pose"],
                "sampled_frame_timestamps_ms": [
                    item["timestamp_ms"] for item in gemini_frames
                ],
                "pose_detection_by_frame": [
                    {
                        "timestamp_ms": frame["timestamp_ms"],
                        "pose_detected": frame.get("landmarks") is not None,
                    }
                    for frame in analysis["frames"]
                ],
            }

            if image_frames:
                gemini_assessment = await run_in_threadpool(
                    analyze_exercise_video_frames,
                    image_frames,
                    pose_measurements,
                )

                if (
                    not gemini_assessment.insufficient_visual_evidence
                    and gemini_assessment.exercise_confidence >= 0.65
                    and gemini_assessment.exercise in supported_exercises
                ):
                    exercise = gemini_assessment.exercise

                if gemini_assessment.counting_mode in {
                    "alternating", "bilateral"
                }:
                    counting_mode = gemini_assessment.counting_mode

        except Exception as error:
            # Log the failure type without exposing credentials or request data.
            print(
                f"[FitLife Gemini] Video assessment failed: "
                f"{type(error).__name__}"
            )
            gemini_assessment = None

        if exercise in supported_exercises:
            repetition_result = await run_in_threadpool(
                analyze_repetitions,
                analysis["frames"],
                exercise,
                counting_mode,
            )
        else:
            repetition_result = {
                "repetitions": 0,
                "analysis_status": "insufficient_data",
                "reason": (
                    "The detected exercise is not yet supported by the "
                    "validated repetition counter."
                ),
            }

        analysis_status = repetition_result["analysis_status"]
        repetitions = repetition_result["repetitions"]

        feedback_message = (
            "Complete movement cycles were detected. Repetition counting "
            "is an experimental estimate and should be checked against "
            "the actual video."
            if analysis_status == "completed"
            else repetition_result["reason"]
        )

        return FormAnalysisResponse(
            exercise=exercise,
            analysis_status=analysis_status,
            repetitions=repetitions,
            form_score=None,
            feedback=[
                FormFeedback(
                    category="repetition_analysis",
                    message=feedback_message,
                    severity=(
                        "info" if analysis_status == "completed" else "warning"
                    ),
                )
            ] + (
                [
                    FormFeedback(
                        category="visual_observation",
                        message=observation[:500],
                        severity="info",
                    )
                    for observation in gemini_assessment.visible_form_observations[:3]
                ]
                if gemini_assessment is not None
                and not gemini_assessment.insufficient_visual_evidence
                else []
            ),
            safety_warnings=[],
            frames_analyzed=analysis["frames_analyzed"],
            summary=(
                f"Video pose analysis completed. Detected exercise: {exercise}. "
                f"Estimated complete repetitions: {repetitions}. "
                "Form scoring and safety assessment are not yet validated."
            ),
        )

    except HTTPException:
        raise

    except PoseAnalysisError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error

    except Exception as error:
        raise HTTPException(
            status_code=503,
            detail="Exercise form analysis is temporarily unavailable.",
        ) from error

    finally:
        await video.close()

# Feature 6: Generative AI Workout Coach
from app.workouts.coach_schemas import (
    WorkoutCoachProposalRequest,
    WorkoutCoachProposalResponse,
)
from app.workouts.coach_service import (
    generate_workout_proposal,
    WorkoutCoachError,
)


@app.post(
    "/workout-coach/propose",
    response_model=WorkoutCoachProposalResponse,
    tags=["Generative AI Workout Coach"],
)
async def create_workout_coach_proposal(
    request: WorkoutCoachProposalRequest,
    x_ai_service_token: str | None = Header(default=None),
):
    verify_ai_service_token(x_ai_service_token)

    try:
        return await run_in_threadpool(
            generate_workout_proposal,
            request,
        )

    except WorkoutCoachError:
        raise HTTPException(
            status_code=503,
            detail="Workout coach service is temporarily unavailable.",
        )
