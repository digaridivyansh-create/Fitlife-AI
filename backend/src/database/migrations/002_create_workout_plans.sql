CREATE TABLE IF NOT EXISTS workout_plans (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    fitness_goal VARCHAR(40) NOT NULL,
    experience_level VARCHAR(20) NOT NULL,
    training_days_per_week SMALLINT NOT NULL
        CHECK (training_days_per_week BETWEEN 1 AND 6),

    session_duration_minutes SMALLINT NOT NULL
        CHECK (session_duration_minutes BETWEEN 15 AND 120),

    workout_location VARCHAR(10) NOT NULL
        CHECK (workout_location IN ('gym', 'home')),

    equipment JSONB NOT NULL DEFAULT '[]'::jsonb,
    plan_data JSONB NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workout_plans_user_created
ON workout_plans(user_id, created_at DESC);
