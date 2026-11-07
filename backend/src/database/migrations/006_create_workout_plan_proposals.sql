BEGIN;

CREATE TABLE IF NOT EXISTS workout_plan_proposals (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    source_workout_plan_id BIGINT NOT NULL,

    original_plan_snapshot JSONB NOT NULL,
    proposed_plan_data JSONB NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),

    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),

    approved_workout_plan_id BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMPTZ,

    CONSTRAINT fk_proposal_owned_source_plan
        FOREIGN KEY (source_workout_plan_id, user_id)
        REFERENCES workout_plans(id, user_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_proposal_owned_approved_plan
        FOREIGN KEY (approved_workout_plan_id, user_id)
        REFERENCES workout_plans(id, user_id),

    CONSTRAINT workout_proposal_approval_consistency
        CHECK (
            (status = 'approved'
                AND approved_workout_plan_id IS NOT NULL
                AND approved_at IS NOT NULL)
            OR
            (status <> 'approved'
                AND approved_workout_plan_id IS NULL
                AND approved_at IS NULL)
        )
);

CREATE INDEX IF NOT EXISTS idx_workout_proposals_user_status
ON workout_plan_proposals(user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workout_proposals_expiry
ON workout_plan_proposals(expires_at)
WHERE status = 'pending';

COMMIT;



