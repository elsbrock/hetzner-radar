-- Migration 0008: Add cloud availability alerts support
-- This migration adds tables to support alerting on cloud server availability changes

-- Cloud availability alert table
CREATE TABLE cloud_availability_alert (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    server_type_ids TEXT NOT NULL, -- JSON array of server type IDs
    location_ids TEXT NOT NULL, -- JSON array of location IDs  
    alert_on TEXT NOT NULL CHECK(alert_on IN ('available', 'unavailable', 'both')),
    email_notifications BOOLEAN DEFAULT TRUE,
    discord_notifications BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

-- Cloud alert history table to track triggered alerts
CREATE TABLE cloud_alert_history (
    id TEXT PRIMARY KEY,
    alert_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    server_type_id INTEGER NOT NULL,
    server_type_name TEXT NOT NULL,
    location_id INTEGER NOT NULL,
    location_name TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK(event_type IN ('available', 'unavailable')),
    triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (alert_id) REFERENCES cloud_availability_alert(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

-- Indexes for efficient querying
CREATE INDEX idx_cloud_alert_user ON cloud_availability_alert(user_id);
CREATE INDEX idx_cloud_alert_created ON cloud_availability_alert(created_at DESC);
CREATE INDEX idx_cloud_history_user ON cloud_alert_history(user_id);
CREATE INDEX idx_cloud_history_alert ON cloud_alert_history(alert_id);
CREATE INDEX idx_cloud_history_triggered ON cloud_alert_history(triggered_at DESC);