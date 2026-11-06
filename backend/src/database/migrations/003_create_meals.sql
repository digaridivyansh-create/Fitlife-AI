BEGIN;

CREATE TABLE IF NOT EXISTS meals (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    meal_name VARCHAR(120),

    consumed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meal_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    meal_id BIGINT NOT NULL
        REFERENCES meals(id) ON DELETE CASCADE,

    food_name VARCHAR(200) NOT NULL,

    fdc_id BIGINT NOT NULL
        CHECK (fdc_id > 0),

    usda_description TEXT NOT NULL,

    serving_weight_g NUMERIC(8,2) NOT NULL
        CHECK (serving_weight_g > 0 AND serving_weight_g <= 5000),

    calories NUMERIC(10,2)
        CHECK (calories IS NULL OR calories >= 0),

    protein_g NUMERIC(10,2)
        CHECK (protein_g IS NULL OR protein_g >= 0),

    carbohydrates_g NUMERIC(10,2)
        CHECK (carbohydrates_g IS NULL OR carbohydrates_g >= 0),

    fat_g NUMERIC(10,2)
        CHECK (fat_g IS NULL OR fat_g >= 0),

    nutrition_source VARCHAR(60) NOT NULL
        DEFAULT 'USDA FoodData Central',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meals_user_consumed
ON meals(user_id, consumed_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_meal_items_meal_id
ON meal_items(meal_id);

COMMIT;
