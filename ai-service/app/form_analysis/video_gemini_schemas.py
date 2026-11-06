from typing import Literal

from pydantic import BaseModel, Field


VideoExerciseType = Literal[
    "squat",
    "push_up",
    "bicep_curl",
    "shoulder_press",
    "lunge",
    "unknown",
]


class GeminiVideoAssessment(BaseModel):
    exercise: VideoExerciseType = "unknown"

    exercise_confidence: float = Field(
        ge=0,
        le=1,
        description="Visual classification confidence, not a calibrated probability.",
    )

    counting_mode: Literal[
        "alternating",
        "bilateral",
        "unknown",
    ] = "unknown"

    movement_pattern: str = Field(
        default="unknown",
        description="Brief description of the movement observed across the supplied frames.",
    )

    visible_form_observations: list[str] = Field(
        default_factory=list,
        description="Only directly observable exercise technique observations.",
    )

    safety_concerns: list[str] = Field(
        default_factory=list,
        description="Only visible concerns; never diagnose injuries or medical conditions.",
    )

    insufficient_visual_evidence: bool = True
