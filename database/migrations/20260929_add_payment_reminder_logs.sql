-- SmartHOA payment reminder audit log
--
-- Safe, additive migration. Existing bills and notification history are not
-- modified. `scheduled_for` stores the policy trigger date, which makes a
-- delayed scheduled job idempotent rather than sending the same notice again.

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
    -- The intended collection-policy date, not necessarily the actual daily
    -- scheduler run date when a missed run is caught up.
    scheduled_for DATE NOT NULL,
    notification_id UUID NULL REFERENCES notifications(notification_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT payment_reminder_logs_recipient_stage_schedule_unique
        UNIQUE (recipient_id, reminder_stage, scheduled_for)
);

CREATE INDEX IF NOT EXISTS idx_payment_reminder_logs_payment_id
    ON payment_reminder_logs(payment_id);

CREATE INDEX IF NOT EXISTS idx_payment_reminder_logs_recipient_schedule
    ON payment_reminder_logs(recipient_id, scheduled_for DESC);
