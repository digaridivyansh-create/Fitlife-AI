from typing import Literal

from pydantic import BaseModel, Field


ExerciseType = Literal[
    "squat",
    "push_up",
    "bicep_curl",
    "shoulder_press",
    "lunge",
    "unknown",
]


class GeminiExerciseAssessment(BaseModel):
    exercise: ExerciseType = "unknown"

    exercise_confidence: float = Field(
        ge=0,
        le=1,
        description="Visual classification confidence, not a calibrated probability.",
    )

    equipment_detected: list[str] = Field(
        default_factory=list,
        description="Only equipment clearly visible in the image.",
    )

    body_position: str = Field(
        description="Brief description of the visible body position.",
    )

    movement_phase: Literal[
        "lowering",
        "lifting",
        "holding",
        "standing",
        "unknown",
    ] = "unknown"

    visible_form_observations: list[str] = Field(
        default_factory=list,
        description="Only directly observable posture or alignment observations.",
    )

    safety_concerns: list[str] = Field(
        default_factory=list,
        description="Visible potential form or safety concerns; do not diagnose injuries.",
    )

    image_quality: Literal[
        "clear",
        "partially_obstructed",
        "poor",
    ] = "poor"

    insufficient_visual_evidence: bool = True
