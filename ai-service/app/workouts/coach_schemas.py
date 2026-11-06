from pydantic import BaseModel, Field

from app.workouts.planner import WorkoutPlanRequest, WorkoutPlanResponse


class WorkoutCoachProposalRequest(BaseModel):
    change_request: str = Field(min_length=5, max_length=2000)
    current_plan: WorkoutPlanResponse
    constraints: WorkoutPlanRequest


class WorkoutCoachProposalResponse(BaseModel):
    summary: str = Field(min_length=10, max_length=1000)
    changes: list[str] = Field(min_length=1, max_length=20)
    proposed_plan: WorkoutPlanResponse
