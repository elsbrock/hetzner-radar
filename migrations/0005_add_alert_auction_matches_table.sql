-- Migration number: 0005 2025-05-02T17:11:00

-- Create table for storing alert-auction matches
CREATE TABLE IF NOT EXISTS alert_auction_matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_history_id INTEGER NOT NULL,
    auction_id UBIGINT NOT NULL,
    match_price INTEGER NOT NULL,
    matched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (alert_history_id) REFERENCES price_alert_history(id) ON DELETE CASCADE
    -- Note: No foreign key constraint on auction_id as the auctions table uses a composite primary key
);

-- Index for quick lookups of all auctions matched by a specific alert
CREATE INDEX IF NOT EXISTS idx_alert_auction_matches_alert_history_id
ON alert_auction_matches(alert_history_id);

-- Index for quick lookups of all alerts that matched a specific auction
CREATE INDEX IF NOT EXISTS idx_alert_auction_matches_auction_id
ON alert_auction_matches(auction_id);

-- Unique index to prevent duplicate matches of the same alert and auction at the same price
-- This allows the same alert-auction pair to match at different prices if the auction price changes
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_alert_auction_match
ON alert_auction_matches(alert_history_id, auction_id, match_price);

-- Drop the temporary staging table as it's no longer needed
-- We'll use the auctions table directly for matching
DROP TABLE IF EXISTS temp_servers_staging;