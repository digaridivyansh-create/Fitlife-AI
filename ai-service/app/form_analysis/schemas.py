from typing import Literal

from pydantic import BaseModel, Field


ExerciseName = Literal[
    "squat",
    "push_up",
    "bicep_curl",
    "shoulder_press",
    "lunge",
    "unknown",
]


class FormFeedback(BaseModel):
    category: str
    message: str
    severity: Literal["info", "warning", "critical"]


class FormAnalysisResponse(BaseModel):
    exercise: ExerciseName
    analysis_status: Literal["completed", "insufficient_data"]
    repetitions: int = Field(ge=0)
    form_score: float | None = Field(default=None, ge=0, le=100)
    feedback: list[FormFeedback] = Field(default_factory=list)
    safety_warnings: list[str] = Field(default_factory=list)
    frames_analyzed: int = Field(ge=0)
    summary: str
