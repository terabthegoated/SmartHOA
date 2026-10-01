-- Web Push subscriptions for the Vercel PWA (including iPhone Home Screen apps).
-- Render uses these records with the VAPID keys stored in its environment.

CREATE TABLE IF NOT EXISTS web_push_subscriptions (
    subscription_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh_key TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    expiration_time BIGINT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_web_push_subscriptions_user_id
    ON web_push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_web_push_subscriptions_enabled
    ON web_push_subscriptions(is_enabled) WHERE is_enabled = TRUE;

ALTER TABLE web_push_subscriptions ENABLE ROW LEVEL SECURITY;
