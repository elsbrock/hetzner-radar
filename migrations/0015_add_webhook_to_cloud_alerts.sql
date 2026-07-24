-- Migration 0015: Add webhook notification support to cloud availability alerts
-- Completes the generic webhook rollout from migration 0014 for the cloud alert type.

ALTER TABLE cloud_availability_alert ADD COLUMN webhook_notifications BOOLEAN DEFAULT FALSE;
