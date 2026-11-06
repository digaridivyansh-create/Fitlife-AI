BEGIN;

-- Required before the composite foreign key is created.
CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_plans_id_user
ON workout_plans(id, user_id);


CREATE TABLE IF NOT EXISTS weight_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    weight_kg NUMERIC(6,2) NOT NULL CHECK (weight_kg BETWEEN 20 AND 500),
    measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weight_logs_user_measured
ON weight_logs(user_id, measured_at DESC, id DESC);


CREATE TABLE IF NOT EXISTS workout_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workout_plan_id BIGINT,
    workout_name VARCHAR(120) NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration_minutes SMALLINT NOT NULL CHECK (duration_minutes BETWEEN 1 AND 600),
    perceived_effort SMALLINT CHECK (
        perceived_effort IS NULL OR perceived_effort BETWEEN 1 AND 10
    ),
    calories_burned NUMERIC(8,2) CHECK (
        calories_burned IS NULL OR calories_burned BETWEEN 0 AND 5000
    ),
    notes VARCHAR(1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_workout_log_owned_plan
        FOREIGN KEY (workout_plan_id, user_id)
        REFERENCES workout_plans(id, user_id)
        ON DELETE SET NULL (workout_plan_id)
);

CREATE INDEX IF NOT EXISTS idx_workout_logs_user_completed
ON workout_logs(user_id, completed_at DESC, id DESC);


CREATE TABLE IF NOT EXISTS daily_progress (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    progress_date DATE NOT NULL DEFAULT CURRENT_DATE,
    calorie_target NUMERIC(8,2) CHECK (
        calorie_target IS NULL OR calorie_target BETWEEN 500 AND 15000
    ),
    protein_target_g NUMERIC(7,2) CHECK (
        protein_target_g IS NULL OR protein_target_g BETWEEN 0 AND 1000
    ),
    steps INTEGER CHECK (steps IS NULL OR steps BETWEEN 0 AND 200000),
    water_ml INTEGER CHECK (water_ml IS NULL OR water_ml BETWEEN 0 AND 20000),
    sleep_hours NUMERIC(4,2) CHECK (
        sleep_hours IS NULL OR sleep_hours BETWEEN 0 AND 24
    ),
    notes VARCHAR(1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (user_id, progress_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_progress_user_date
ON daily_progress(user_id, progress_date DESC);

COMMIT;
