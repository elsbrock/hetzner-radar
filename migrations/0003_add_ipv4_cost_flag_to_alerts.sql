-- Add the flag to track if an alert was created considering the IPv4 cost.
-- Default to TRUE for new alerts created after this change.
ALTER TABLE alerts
ADD COLUMN includes_ipv4_cost BOOLEAN DEFAULT TRUE;

-- Update existing alerts (where the flag is NULL after the ALTER TABLE)
-- to ensure they use the old comparison logic (without added IPv4 cost).
UPDATE alerts SET includes_ipv4_cost = FALSE WHERE includes_ipv4_cost IS NULL;