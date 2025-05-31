-- Add Discord webhook support and per-alert notification preferences
-- Migration 0007: Add Discord webhook support and per-alert notification preferences

-- Add Discord webhook URL storage to user table
ALTER TABLE user ADD COLUMN discord_webhook_url TEXT;

-- Add notification preferences as JSON for flexibility to user table
ALTER TABLE user ADD COLUMN notification_preferences TEXT DEFAULT '{"email": true, "discord": false}';

-- Add per-alert notification preferences to price_alert table
ALTER TABLE price_alert ADD COLUMN email_notifications BOOLEAN DEFAULT TRUE;
ALTER TABLE price_alert ADD COLUMN discord_notifications BOOLEAN DEFAULT FALSE;

-- Update existing alerts to use their user's current notification preferences
-- Email is always enabled as fallback, Discord based on user preference and webhook availability
UPDATE price_alert 
SET discord_notifications = (
    SELECT CASE 
        WHEN user.discord_webhook_url IS NOT NULL 
             AND JSON_EXTRACT(user.notification_preferences, '$.discord') = 1 
        THEN 1 
        ELSE 0 
    END
    FROM user 
    WHERE user.id = price_alert.user_id
)
WHERE discord_notifications IS NULL OR discord_notifications = 0;

-- Add notification preferences to price_alert_history table
ALTER TABLE price_alert_history ADD COLUMN email_notifications BOOLEAN DEFAULT TRUE;
ALTER TABLE price_alert_history ADD COLUMN discord_notifications BOOLEAN DEFAULT FALSE;