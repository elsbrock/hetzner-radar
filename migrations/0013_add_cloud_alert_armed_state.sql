-- Migration 0013: Add armed state to cloud availability alerts
-- Cloud alerts auto-disarm after firing to prevent continuous notifications (fixes #264)

ALTER TABLE cloud_availability_alert ADD COLUMN is_armed BOOLEAN NOT NULL DEFAULT TRUE;
