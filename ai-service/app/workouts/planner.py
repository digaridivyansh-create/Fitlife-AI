from typing import Literal

from pydantic import BaseModel, Field, model_validator


WorkoutLocation = Literal["gym", "home"]

FitnessGoal = Literal[
    "weight_loss",
    "muscle_gain",
    "endurance",
    "general_fitness",
]

ExperienceLevel = Literal[
    "beginner",
    "intermediate",
    "advanced",
]


class WorkoutPlanRequest(BaseModel):
    fitness_goal: FitnessGoal
    experience_level: ExperienceLevel

    training_days_per_week: int = Field(ge=1, le=6)
    session_duration_minutes: int = Field(ge=15, le=120)

    workout_location: WorkoutLocation

    equipment: list[str] = Field(default_factory=list)
    activity_level: Literal[
        "sedentary",
        "lightly_active",
        "moderately_active",
        "very_active",
        "extra_active",
    ]

    @model_validator(mode="after")
    def validate_equipment(self):
        normalized = [
            item.strip().lower()
            for item in self.equipment
            if item.strip()
        ]

        if self.workout_location == "home" and not normalized:
            normalized = ["bodyweight"]

        if self.workout_location == "gym" and not normalized:
            raise ValueError(
                "Select at least one available gym equipment option."
            )

        self.equipment = list(dict.fromkeys(normalized))
        return self


class Exercise(BaseModel):
    name: str
    category: str
    equipment: list[str]
    muscle_groups: list[str]
    beginner_sets: int
    intermediate_sets: int
    advanced_sets: int
    reps: str
    rest_seconds: int


class PlannedExercise(BaseModel):
    name: str
    category: str
    muscle_groups: list[str]
    sets: int
    reps: str
    rest_seconds: int


class WorkoutDay(BaseModel):
    day: int
    title: str
    focus: str
    exercises: list[PlannedExercise]
    estimated_duration_minutes: int


class WorkoutPlanResponse(BaseModel):
    goal: str
    experience_level: str
    workout_location: str
    training_days_per_week: int
    session_duration_minutes: int
    weekly_schedule: list[WorkoutDay]
    rest_days: list[int]
    progression_guidance: str
    safety_note: str
EXERCISE_CATALOGUE = [
    # Chest
    Exercise(
        name="Push-ups",
        category="chest",
        equipment=["bodyweight"],
        muscle_groups=["chest", "triceps", "shoulders"],
        beginner_sets=2,
        intermediate_sets=3,
        advanced_sets=4,
        reps="8-12",
        rest_seconds=60,
    ),
    Exercise(
        name="Dumbbell Bench Press",
        category="chest",
        equipment=["dumbbells", "bench"],
        muscle_groups=["chest", "triceps"],
        beginner_sets=2,
        intermediate_sets=3,
        advanced_sets=4,
        reps="8-12",
        rest_seconds=90,
    ),
    Exercise(
        name="Barbell Bench Press",
        category="chest",
        equipment=["barbell", "bench"],
        muscle_groups=["chest", "triceps", "shoulders"],
        beginner_sets=2,
        intermediate_sets=3,
        advanced_sets=4,
        reps="6-10",
        rest_seconds=120,
    ),

    # Back
    Exercise(
        name="Resistance Band Rows",
        category="back",
        equipment=["resistance_bands"],
        muscle_groups=["back", "biceps"],
        beginner_sets=2,
        intermediate_sets=3,
        advanced_sets=4,
        reps="10-15",
        rest_seconds=60,
    ),
    Exercise(
        name="Dumbbell Rows",
        category="back",
        equipment=["dumbbells"],
        muscle_groups=["back", "biceps"],
        beginner_sets=2,
        intermediate_sets=3,
        advanced_sets=4,
        reps="8-12",
        rest_seconds=90,
    ),
    Exercise(
        name="Lat Pulldown",
        category="back",
        equipment=["lat_pulldown_machine"],
        muscle_groups=["back", "biceps"],
        beginner_sets=2,
        intermediate_sets=3,
        advanced_sets=4,
        reps="10-12",
        rest_seconds=90,
    ),

    # Legs
    Exercise(
        name="Bodyweight Squats",
        category="legs",
        equipment=["bodyweight"],
        muscle_groups=["quadriceps", "glutes"],
        beginner_sets=2,
        intermediate_sets=3,
        advanced_sets=4,
        reps="12-15",
        rest_seconds=60,
    ),
    Exercise(
        name="Dumbbell Goblet Squats",
        category="legs",
        equipment=["dumbbells"],
        muscle_groups=["quadriceps", "glutes"],
        beginner_sets=2,
        intermediate_sets=3,
        advanced_sets=4,
        reps="10-12",
        rest_seconds=90,
    ),
    Exercise(
        name="Leg Press",
        category="legs",
        equipment=["leg_press_machine"],
        muscle_groups=["quadriceps", "glutes"],
        beginner_sets=2,
        intermediate_sets=3,
        advanced_sets=4,
        reps="10-12",
        rest_seconds=90,
    ),
    Exercise(
        name="Dumbbell Romanian Deadlift",
        category="legs",
        equipment=["dumbbells"],
        muscle_groups=["hamstrings", "glutes"],
        beginner_sets=2,
        intermediate_sets=3,
        advanced_sets=4,
        reps="8-12",
        rest_seconds=90,
    ),

    # Shoulders
    Exercise(
        name="Pike Push-ups",
        category="shoulders",
        equipment=["bodyweight"],
        muscle_groups=["shoulders", "triceps"],
        beginner_sets=2,
        intermediate_sets=3,
        advanced_sets=4,
        reps="6-10",
        rest_seconds=60,
    ),
    Exercise(
        name="Dumbbell Shoulder Press",
        category="shoulders",
        equipment=["dumbbells"],
        muscle_groups=["shoulders", "triceps"],
        beginner_sets=2,
        intermediate_sets=3,
        advanced_sets=4,
        reps="8-12",
        rest_seconds=90,
    ),

    # Arms
    Exercise(
        name="Dumbbell Bicep Curls",
        category="arms",
        equipment=["dumbbells"],
        muscle_groups=["biceps"],
        beginner_sets=2,
        intermediate_sets=3,
        advanced_sets=4,
        reps="10-12",
        rest_seconds=60,
    ),
    Exercise(
        name="Resistance Band Triceps Extensions",
        category="arms",
        equipment=["resistance_bands"],
        muscle_groups=["triceps"],
        beginner_sets=2,
        intermediate_sets=3,
        advanced_sets=4,
        reps="10-15",
        rest_seconds=60,
    ),

    # Core
    Exercise(
        name="Plank",
        category="core",
        equipment=["bodyweight"],
        muscle_groups=["abdominals", "core"],
        beginner_sets=2,
        intermediate_sets=3,
        advanced_sets=4,
        reps="20-45 seconds",
        rest_seconds=45,
    ),
    Exercise(
        name="Dead Bug",
        category="core",
        equipment=["bodyweight"],
        muscle_groups=["abdominals", "core"],
        beginner_sets=2,
        intermediate_sets=3,
        advanced_sets=4,
        reps="10-12 per side",
        rest_seconds=45,
    ),

    # Cardio
    Exercise(
        name="Jumping Jacks",
        category="cardio",
        equipment=["bodyweight"],
        muscle_groups=["full_body"],
        beginner_sets=2,
        intermediate_sets=3,
        advanced_sets=4,
        reps="30 seconds",
        rest_seconds=45,
    ),
    Exercise(
        name="Stationary Cycling",
        category="cardio",
        equipment=["stationary_bike"],
        muscle_groups=["legs", "cardiovascular"],
        beginner_sets=2,
        intermediate_sets=3,
        advanced_sets=4,
        reps="3 minutes",
        rest_seconds=60,
    ),
]
def _get_sets(
    exercise: Exercise,
    experience: str,
    activity_level: str,
) -> int:
    if experience == "beginner":
        sets = exercise.beginner_sets
    elif experience == "intermediate":
        sets = exercise.intermediate_sets
    else:
        sets = exercise.advanced_sets

    # A sedentary user starts with a more conservative training volume.
    if activity_level == "sedentary":
        sets = max(1, sets - 1)

    return sets


def _get_activity_recovery_guidance(activity_level: str) -> str:
    guidance = {
        "sedentary": (
            "Begin gradually and allow adequate recovery while adapting "
            "to regular exercise."
        ),
        "lightly_active": (
            "Build consistency gradually and monitor how your body recovers."
        ),
        "moderately_active": (
            "Maintain consistent training and allow recovery between "
            "demanding sessions."
        ),
        "very_active": (
            "Account for your existing physical activity and avoid "
            "unnecessary additional training volume."
        ),
        "extra_active": (
            "Your existing physical workload may already be substantial. "
            "Prioritize recovery, sleep, and adequate nutrition."
        ),
    }

    return guidance[activity_level]


def _get_available_exercises(
    request: WorkoutPlanRequest,
) -> list[Exercise]:
    available = set(request.equipment)

    if request.workout_location == "home":
        available.add("bodyweight")

    return [
        exercise
        for exercise in EXERCISE_CATALOGUE
        if set(exercise.equipment).issubset(available)
    ]


def _get_focus_groups(goal: str):
    if goal == "endurance":
        return [
            ("Cardio and Core", ["cardio", "core"]),
            ("Lower Body and Conditioning", ["legs", "cardio"]),
            ("Full Body Conditioning", ["cardio", "chest", "core"]),
        ]

    if goal == "weight_loss":
        return [
            ("Full Body", ["legs", "chest", "core"]),
            ("Strength and Conditioning", ["back", "shoulders", "cardio"]),
            ("Full Body Conditioning", ["chest", "legs", "cardio"]),
        ]

    if goal == "muscle_gain":
        return [
            ("Upper Body", ["chest", "back", "shoulders", "arms"]),
            ("Lower Body", ["legs", "core"]),
            ("Full Body Strength", ["chest", "back", "legs"]),
        ]

    return [
        ("Full Body", ["chest", "back", "legs", "core"]),
        ("Balanced Strength", ["shoulders", "arms", "legs"]),
        ("Full Body Fitness", ["chest", "back", "cardio"]),
    ]


def _estimate_duration(exercises: list[PlannedExercise]) -> int:
    # Approximate warm-up and transitions.
    total = 10

    for exercise in exercises:
        total += exercise.sets * (
            exercise.rest_seconds / 60 + 1
        )

    return round(total)


def generate_workout_plan(
    request: WorkoutPlanRequest,
) -> WorkoutPlanResponse:
    available_exercises = _get_available_exercises(request)

    if not available_exercises:
        raise ValueError(
            "No exercises match the selected equipment. "
            "Please select more available equipment."
        )

    focus_groups = _get_focus_groups(request.fitness_goal)

    day_patterns = {
        1: [1],
        2: [1, 4],
        3: [1, 3, 5],
        4: [1, 3, 5, 7],
        5: [1, 2, 4, 5, 7],
        6: [1, 2, 3, 4, 5, 6],
    }

    selected_days = day_patterns[request.training_days_per_week]
    weekly_schedule = []
    used_exercise_names = set()

    max_exercises = max(
        1,
        min(6, request.session_duration_minutes // 8),
    )

    for index, day_number in enumerate(selected_days):
        title, categories = focus_groups[index % len(focus_groups)]

        matching = [
            exercise
            for exercise in available_exercises
            if exercise.category in categories
        ]

        fresh = [
            exercise for exercise in matching
            if exercise.name not in used_exercise_names
        ]

        previously_used = [
            exercise for exercise in matching
            if exercise.name in used_exercise_names
        ]

        ordered = fresh + previously_used

        chosen = []
        used_categories = set()

        # Prefer variety across exercise categories.
        for exercise in ordered:
            if exercise.category not in used_categories:
                chosen.append(exercise)
                used_categories.add(exercise.category)

        for exercise in ordered:
            if len(chosen) >= max_exercises:
                break
            if exercise not in chosen:
                chosen.append(exercise)

        planned_exercises = []

        for exercise in chosen:
            planned = PlannedExercise(
                name=exercise.name,
                category=exercise.category,
                muscle_groups=exercise.muscle_groups,
                sets=_get_sets(
                    exercise,
                    request.experience_level,
                    request.activity_level,
                ),
                reps=exercise.reps,
                rest_seconds=exercise.rest_seconds,
            )

            candidate = planned_exercises + [planned]

            if (
                _estimate_duration(candidate)
                > request.session_duration_minutes
            ):
                continue

            planned_exercises.append(planned)

        if not planned_exercises:
            raise ValueError(
                "The selected session duration is too short "
                "for the available exercises."
            )

        used_exercise_names.update(
            exercise.name for exercise in planned_exercises
        )

        weekly_schedule.append(
            WorkoutDay(
                day=day_number,
                title=title,
                focus=", ".join(categories),
                exercises=planned_exercises,
                estimated_duration_minutes=_estimate_duration(
                    planned_exercises
                ),
            )
        )

    actual_training_days = {
        day.day for day in weekly_schedule
    }

    rest_days = [
        day for day in range(1, 8)
        if day not in actual_training_days
    ]

    if request.experience_level == "beginner":
        progression = (
            "Start with comfortable resistance and controlled technique. "
            "When all prescribed repetitions feel manageable, gradually "
            "increase repetitions before increasing resistance."
        )
    elif request.experience_level == "intermediate":
        progression = (
            "Track completed sets and repetitions. Progress gradually by "
            "increasing repetitions or resistance while maintaining good form."
        )
    else:
        progression = (
            "Use structured progressive overload. Increase training load "
            "gradually, monitor recovery, and schedule lighter training "
            "periods when needed."
        )

    return WorkoutPlanResponse(
        goal=request.fitness_goal,
        experience_level=request.experience_level,
        workout_location=request.workout_location,
        training_days_per_week=len(weekly_schedule),
        session_duration_minutes=request.session_duration_minutes,
        weekly_schedule=weekly_schedule,
        rest_days=rest_days,
        progression_guidance=(
            progression
            + " "
            + _get_activity_recovery_guidance(request.activity_level)
        ),
        safety_note=(
            "Warm up before training and use controlled movements. "
            "Stop if you experience pain, dizziness, or unusual discomfort. "
            "Exercise selection and duration are estimates, not medical advice."
        ),
    )
