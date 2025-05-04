-- Migration number: 0006 2025-05-04T11:28:00

-- Change primary key of alert_auction_matches from id to (alert_history_id, auction_id)

-- Create a new table with the desired structure
CREATE TABLE alert_auction_matches_new (
    alert_history_id INTEGER NOT NULL,
    auction_id UBIGINT NOT NULL,
    auction_seen_at TIMESTAMP NOT NULL,
    match_price INTEGER NOT NULL,
    matched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (alert_history_id, auction_id, auction_seen_at),
    FOREIGN KEY (alert_history_id) REFERENCES price_alert_history(id) ON DELETE CASCADE
);

-- Copy all data from the old table to the new one, joining with auctions to get seen_at
INSERT INTO alert_auction_matches_new (alert_history_id, auction_id, auction_seen_at, match_price, matched_at)
SELECT aam.alert_history_id, aam.auction_id, a.seen, aam.match_price, aam.matched_at
FROM alert_auction_matches aam
INNER JOIN auctions a ON aam.auction_id = a.id;

-- Drop the old table
DROP TABLE alert_auction_matches;

-- Rename the new table to the original name
ALTER TABLE alert_auction_matches_new RENAME TO alert_auction_matches;

-- Recreate the index for auction_id (alert_history_id is already part of the primary key)
CREATE INDEX IF NOT EXISTS idx_alert_auction_matches_auction_id
ON alert_auction_matches(auction_id);

-- Recreate the unique index for different prices of the same alert-auction pair
-- Note: We only need match_price in this index now since alert_history_id, auction_id, and auction_seen_at
-- are already uniquely constrained by the primary key
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_alert_auction_match_price
