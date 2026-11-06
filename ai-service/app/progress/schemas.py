from typing import Literal

from pydantic import BaseModel, Field


class WeightMeasurement(BaseModel):
    weight_kg: float = Field(gt=0, le=500)
    measured_at: str
    notes: str | None = Field(default=None, max_length=500)


class WeightSummary(BaseModel):
    measurement_count: int = Field(ge=0)
    measurements: list[WeightMeasurement] = Field(default_factory=list, max_length=100)


class WorkoutSummary(BaseModel):
    completed_workouts: int = Field(ge=0)
    total_duration_minutes: int = Field(ge=0)
    average_perceived_effort: float | None = Field(default=None, ge=1, le=10)
    workouts_with_calorie_estimates: int = Field(ge=0)
    total_calories_burned: float | None = Field(default=None, ge=0)


class DailyProgressEntry(BaseModel):
    progress_date: str
    calorie_target: float | None = Field(default=None, ge=500, le=15000)
    protein_target_g: float | None = Field(default=None, ge=0, le=1000)
    steps: int | None = Field(default=None, ge=0, le=200000)
    water_ml: int | None = Field(default=None, ge=0, le=20000)
    sleep_hours: float | None = Field(default=None, ge=0, le=24)


class DailyTrackingSummary(BaseModel):
    recorded_days: int = Field(ge=0)
    entries: list[DailyProgressEntry] = Field(default_factory=list, max_length=90)


class NutritionDay(BaseModel):
    meal_date: str
    meal_count: int = Field(ge=0)
    food_item_count: int = Field(ge=0)
    items_with_calories: int = Field(ge=0)
    items_with_protein: int = Field(ge=0)
    items_with_carbs: int = Field(ge=0)
    items_with_fat: int = Field(ge=0)
    total_calories: float | None = Field(default=None, ge=0)
    total_protein_g: float | None = Field(default=None, ge=0)
    total_carbohydrates_g: float | None = Field(default=None, ge=0)
    total_fat_g: float | None = Field(default=None, ge=0)


class NutritionSummary(BaseModel):
    recorded_meal_days: int = Field(ge=0)
    daily_totals: list[NutritionDay] = Field(default_factory=list, max_length=90)


class ProgressInsightsRequest(BaseModel):
    period_days: Literal[7, 30, 90]
    timezone: Literal["Asia/Kolkata"]
    weight: WeightSummary
    workouts: WorkoutSummary
    daily_tracking: DailyTrackingSummary
    nutrition: NutritionSummary


class InsightItem(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    detail: str = Field(min_length=1, max_length=1200)
    category: Literal[
        "weight",
        "workouts",
        "nutrition",
        "habits",
        "data_quality",
    ]


class ProgressInsightsResponse(BaseModel):
    headline: str = Field(min_length=1, max_length=300)
    summary: str = Field(min_length=1, max_length=3000)
    data_sufficiency: Literal["insufficient", "limited", "adequate"]
    observations: list[InsightItem] = Field(default_factory=list, max_length=8)
    recommendations: list[InsightItem] = Field(default_factory=list, max_length=8)
    data_gaps: list[str] = Field(default_factory=list, max_length=8)
    safety_note: str = Field(min_length=1, max_length=500)
