-- Run this migration in Supabase before enabling Firebase Cloud Messaging.
-- It records the current device token for a signed-in SmartHOA user.

CREATE TABLE IF NOT EXISTS push_devices (
    device_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    fcm_token TEXT NOT NULL UNIQUE,
    platform VARCHAR(30) NOT NULL DEFAULT 'android',
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_push_devices_user_id ON push_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_push_devices_enabled ON push_devices(is_enabled) WHERE is_enabled = TRUE;
