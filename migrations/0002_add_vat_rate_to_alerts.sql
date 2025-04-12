-- Migration number: 0002
-- Purpose: Add vat_rate column to price_alert and price_alert_history tables

ALTER TABLE price_alert
ADD COLUMN vat_rate INTEGER NOT NULL DEFAULT 0;

ALTER TABLE price_alert_history
ADD COLUMN vat_rate INTEGER NOT NULL DEFAULT 0;