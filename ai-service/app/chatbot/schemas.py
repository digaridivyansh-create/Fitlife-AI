from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


class ChatHistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=8000)

    @field_validator("content")
    @classmethod
    def validate_content(cls, value: str) -> str:
        value = value.strip()

        if not value:
            raise ValueError("Message content cannot be empty.")

        return value


class FitnessProfileContext(BaseModel):
    full_name: str | None = Field(default=None, max_length=120)
    height_cm: float | None = Field(default=None, gt=0, le=300)
    weight_kg: float | None = Field(default=None, gt=0, le=700)
    fitness_goal: str | None = Field(default=None, max_length=40)
    activity_level: str | None = Field(default=None, max_length=40)


class WorkoutContext(BaseModel):
    fitness_goal: str | None = None
    experience_level: str | None = None
    training_days_per_week: int | None = None
    session_duration_minutes: int | None = None
    workout_location: str | None = None
    created_at: str | None = None
    plan_data: dict[str, Any] = Field(default_factory=dict)


class MealItemContext(BaseModel):
    food_name: str
    serving_weight_g: float | None = None
    calories: float | None = None
    protein_g: float | None = None
    carbohydrates_g: float | None = None
    fat_g: float | None = None


class MealContext(BaseModel):
    meal_name: str | None = None
    consumed_at: str | None = None
    items: list[MealItemContext] = Field(default_factory=list)


class FitnessContext(BaseModel):
    profile: FitnessProfileContext | None = None
    recent_workouts: list[WorkoutContext] = Field(
        default_factory=list,
        max_length=5,
    )
    recent_meals: list[MealContext] = Field(
        default_factory=list,
        max_length=10,
    )


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    history: list[ChatHistoryMessage] = Field(
        default_factory=list,
        max_length=12,
    )
    context: FitnessContext = Field(default_factory=FitnessContext)

    @field_validator("message")
    @classmethod
    def validate_message(cls, value: str) -> str:
        value = value.strip()

        if not value:
            raise ValueError("Message cannot be empty.")

        return value


class ChatResponse(BaseModel):
    answer: str = Field(min_length=1, max_length=8000)
