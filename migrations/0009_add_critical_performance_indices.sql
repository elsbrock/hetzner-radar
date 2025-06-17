-- Emergency migration to fix excessive D1 reads on 1.1M+ records
-- This will dramatically reduce query costs for MAX(seen) operations

-- CRITICAL: Index on seen column for MAX(seen) queries
-- This alone should reduce reads by 90%+
CREATE INDEX IF NOT EXISTS idx_auctions_seen ON auctions(seen DESC);

-- Composite index for latest batch queries with common filters
CREATE INDEX IF NOT EXISTS idx_auctions_seen_location_cpu ON auctions(seen DESC, location, cpu_vendor);

-- Index for price-based queries in the latest batch
CREATE INDEX IF NOT EXISTS idx_auctions_seen_price ON auctions(seen DESC, price);

-- Index to optimize lookups by auction ID in recent batches
CREATE INDEX IF NOT EXISTS idx_auctions_id_seen ON auctions(id, seen DESC);