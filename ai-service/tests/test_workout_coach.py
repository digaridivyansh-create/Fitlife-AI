import json
import os
import unittest
from unittest.mock import patch, MagicMock

from app.workouts.planner import (
    PlannedExercise,
    WorkoutDay,
    WorkoutPlanRequest,
    WorkoutPlanResponse,
    _estimate_duration,
)
from app.workouts.coach_schemas import (
    WorkoutCoachProposalRequest,
    WorkoutCoachProposalResponse,
)
from app.workouts.coach_service import (
    WorkoutCoachError,
    _validate_and_normalize_proposal,
    generate_workout_proposal,
)


def exercise(name, category, muscles, sets=2, reps="8-12", rest=60):
    return PlannedExercise(
        name=name,
        category=category,
        muscle_groups=muscles,
        sets=sets,
        reps=reps,
        rest_seconds=rest,
    )


def make_plan(replace_bench=False):
    day1_exercises = [
        exercise(
            "Push-ups" if replace_bench else "Dumbbell Bench Press",
            "chest",
            ["chest", "triceps", "shoulders"]
            if replace_bench else ["chest", "triceps"],
        ),
        exercise("Dumbbell Rows", "back", ["back", "biceps"], rest=90),
    ]
    day3_exercises = [
        exercise("Dumbbell Goblet Squats", "legs", ["quadriceps", "glutes"], rest=90)
    ]
    day5_exercises = [
        exercise("Dumbbell Shoulder Press", "shoulders", ["shoulders", "triceps"], rest=90)
    ]

    days = []
    for number, title, focus, items in [
        (1, "Upper Body", "chest, back", day1_exercises),
        (3, "Lower Body", "legs", day3_exercises),
        (5, "Full Body", "shoulders", day5_exercises),
    ]:
        days.append(
            WorkoutDay(
                day=number,
                title=title,
                focus=focus,
                exercises=items,
                estimated_duration_minutes=_estimate_duration(items),
            )
        )

    return WorkoutPlanResponse(
        goal="muscle_gain",
        experience_level="beginner",
        workout_location="gym",
        training_days_per_week=3,
        session_duration_minutes=30,
        weekly_schedule=days,
        rest_days=[2, 4, 6, 7],
        progression_guidance="Increase repetitions gradually.",
        safety_note="Stop if you experience pain or dizziness.",
    )


def make_request():
    return WorkoutCoachProposalRequest(
        change_request="Replace Dumbbell Bench Press with Push-ups on Day 1.",
        current_plan=make_plan(),
        constraints=WorkoutPlanRequest(
            fitness_goal="muscle_gain",
            experience_level="beginner",
            training_days_per_week=3,
            session_duration_minutes=30,
            workout_location="gym",
            equipment=["dumbbells", "bench"],
            activity_level="moderately_active",
        ),
    )


def make_response(request, invalid_exercise=False, unchanged=False):
    plan = make_plan(replace_bench=not unchanged)

    if invalid_exercise:
        plan.weekly_schedule[0].exercises[0].name = "Invented Machine Press"

    result = WorkoutCoachProposalResponse(
        summary="Proposed workout modification for review.",
        changes=["Replace the Day 1 chest exercise."],
        proposed_plan=plan,
    )
    return result


class TemporaryGeminiError(Exception):
    code = 503


class WorkoutCoachTests(unittest.TestCase):

    def setUp(self):
        self.request = make_request()
        self.env = patch.dict(os.environ, {"GEMINI_API_KEY": "mock-test-key"})
        self.env.start()
        self.addCleanup(self.env.stop)

    def mocked_client(self, response):
        client = MagicMock()
        client.models.generate_content.return_value = response
        return client

    def test_valid_proposal_is_normalized(self):
        result = make_response(self.request)
        normalized = _validate_and_normalize_proposal(result, self.request)

        self.assertEqual(normalized.proposed_plan.weekly_schedule[0].exercises[0].name, "Push-ups")
        self.assertTrue(any("removed Dumbbell Bench Press" in item for item in normalized.changes))
        self.assertTrue(any("added Push-ups" in item for item in normalized.changes))

    def test_unavailable_exercise_is_rejected(self):
        result = make_response(self.request, invalid_exercise=True)

        with self.assertRaises(WorkoutCoachError):
            _validate_and_normalize_proposal(result, self.request)

    def test_unchanged_plan_is_rejected(self):
        result = make_response(self.request, unchanged=True)

        with self.assertRaises(WorkoutCoachError):
            _validate_and_normalize_proposal(result, self.request)

    def test_gemini_success(self):
        result = make_response(self.request)
        response = MagicMock()
        response.text = result.model_dump_json()

        with patch("app.workouts.coach_service.genai.Client") as client_factory:
            client_factory.return_value = self.mocked_client(response)
            output = generate_workout_proposal(self.request)

        self.assertEqual(output.proposed_plan.weekly_schedule[0].exercises[0].name, "Push-ups")

    def test_gemini_retries_temporary_503_then_succeeds(self):
        result = make_response(self.request)
        response = MagicMock()
        response.text = result.model_dump_json()

        client = self.mocked_client(response)
        client.models.generate_content.side_effect = [
            TemporaryGeminiError("temporary outage"),
            response,
        ]

        with patch("app.workouts.coach_service.genai.Client", return_value=client), \
             patch("app.workouts.coach_service.time.sleep") as sleep_mock:
            output = generate_workout_proposal(self.request)

        self.assertEqual(client.models.generate_content.call_count, 2)
        sleep_mock.assert_called_once_with(1)
        self.assertEqual(output.proposed_plan.weekly_schedule[0].exercises[0].name, "Push-ups")

    def test_gemini_stops_after_three_temporary_failures(self):
        client = self.mocked_client(None)
        client.models.generate_content.side_effect = [
            TemporaryGeminiError("temporary outage"),
            TemporaryGeminiError("temporary outage"),
            TemporaryGeminiError("temporary outage"),
        ]

        with patch("app.workouts.coach_service.genai.Client", return_value=client), \
             patch("app.workouts.coach_service.time.sleep"):
            with self.assertRaises(WorkoutCoachError):
                generate_workout_proposal(self.request)

        self.assertEqual(client.models.generate_content.call_count, 3)

    def test_missing_api_key_is_rejected(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(WorkoutCoachError):
                generate_workout_proposal(self.request)


if __name__ == "__main__":
    unittest.main(verbosity=2)
