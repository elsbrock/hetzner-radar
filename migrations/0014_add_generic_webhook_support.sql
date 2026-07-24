-- Migration 0014: Add generic webhook notification support
-- Mirrors the Discord webhook shape from migration 0007: per-user endpoint URL
-- plus per-alert opt-in flags. The notification_preferences JSON gains a
-- "webhook" key, which is defaulted in application code when absent.

ALTER TABLE user ADD COLUMN webhook_url TEXT;

ALTER TABLE price_alert ADD COLUMN webhook_notifications BOOLEAN DEFAULT FALSE;

ALTER TABLE price_alert_history ADD COLUMN webhook_notifications BOOLEAN DEFAULT FALSE;
