-- Explainable complaint-priority Decision Support System (DSS).
-- This migration is additive: existing complaints and their current priorities
-- are preserved without being reclassified.

ALTER TABLE complaints
    ADD COLUMN IF NOT EXISTS priority_recommendation urgency_level_enum,
    ADD COLUMN IF NOT EXISTS priority_rule_code VARCHAR(100),
    ADD COLUMN IF NOT EXISTS priority_reason TEXT,
    ADD COLUMN IF NOT EXISTS priority_overridden_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS priority_overridden_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS priority_override_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_complaints_priority_recommendation
    ON complaints(priority_recommendation);

COMMENT ON COLUMN complaints.priority_level IS
    'Effective priority used for the complaint queue. It initially equals the DSS recommendation and may later be overridden by an HOA officer.';
COMMENT ON COLUMN complaints.priority_recommendation IS
    'Rule-based priority recommended when the complaint was submitted.';
COMMENT ON COLUMN complaints.priority_rule_code IS
    'Stable code identifying the rule that produced the recommendation.';
COMMENT ON COLUMN complaints.priority_reason IS
    'Plain-language explanation of the recommendation and its matched criteria.';
COMMENT ON COLUMN complaints.priority_override_reason IS
    'Officer-provided reason when the final priority differs from the DSS recommendation.';
