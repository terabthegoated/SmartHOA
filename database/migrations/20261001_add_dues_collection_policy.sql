-- SmartHOA collection-policy engine
-- Implements Board Resolution No. 12 (Series of 2025) without altering
-- historical payments. An assessment is an auditable snapshot of the balance
-- calculated after a missed 16th-of-the-month due date.

-- Included again here so this policy migration is safe to run even when the
-- earlier reminder-log migration was not yet applied.
CREATE TABLE IF NOT EXISTS payment_reminder_logs (
    reminder_log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID NOT NULL REFERENCES payments(payment_id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    reminder_stage VARCHAR(50) NOT NULL CHECK (
        reminder_stage IN (
            'courtesy_reminder',
            'final_reminder',
            'first_notice',
            'second_notice',
            'third_notice_hearing'
        )
    ),
    scheduled_for DATE NOT NULL,
    notification_id UUID NULL REFERENCES notifications(notification_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (recipient_id, reminder_stage, scheduled_for)
);

CREATE INDEX IF NOT EXISTS idx_payment_reminder_logs_payment_id
    ON payment_reminder_logs(payment_id);

CREATE INDEX IF NOT EXISTS idx_payment_reminder_logs_recipient_schedule
    ON payment_reminder_logs(recipient_id, scheduled_for DESC);

CREATE TABLE IF NOT EXISTS dues_policy_assessments (
    assessment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resident_id UUID NOT NULL REFERENCES resident_profiles(resident_id) ON DELETE CASCADE,
    policy_date DATE NOT NULL,
    base_balance DECIMAL(10, 2) NOT NULL CHECK (base_balance >= 0),
    previous_cycle_balance DECIMAL(10, 2) NOT NULL CHECK (previous_cycle_balance >= 0),
    monthly_dues_added DECIMAL(10, 2) NOT NULL CHECK (monthly_dues_added >= 0),
    interest_amount DECIMAL(10, 2) NOT NULL CHECK (interest_amount >= 0),
    total_balance DECIMAL(10, 2) NOT NULL CHECK (total_balance >= 0),
    months_overdue SMALLINT NOT NULL CHECK (months_overdue >= 1),
    collection_stage VARCHAR(50) NOT NULL CHECK (
        collection_stage IN ('first_notice', 'second_notice', 'third_notice_hearing')
    ),
    requires_hearing BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (resident_id, policy_date)
);

CREATE INDEX IF NOT EXISTS idx_dues_policy_assessments_resident_date
    ON dues_policy_assessments(resident_id, policy_date DESC);

CREATE INDEX IF NOT EXISTS idx_dues_policy_assessments_stage
    ON dues_policy_assessments(collection_stage, policy_date DESC);

-- Keep the policy values aligned with the Board Resolution even in databases
-- seeded before the ₱325 / 10% policy was added to the project.
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
    ('monthly_hoa_fee', '325.00', 'Default monthly HOA fee amount, payable on or before the 16th.'),
    ('penalty_rate', '0.10', '10% compounding interest applied to the total outstanding balance every 16th.')
ON CONFLICT (setting_key) DO UPDATE
SET setting_value = EXCLUDED.setting_value,
    description = EXCLUDED.description,
    updated_at = CURRENT_TIMESTAMP;
