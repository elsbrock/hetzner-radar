-- Clean up historical duplicate auction entries
-- Keep only records where price actually changed, reducing ~1.1M records to ~100K

-- Create temporary table with deduplicated data
CREATE TABLE auctions_deduped AS
WITH PriceChanges AS (
  SELECT 
    *,
    LAG(price) OVER (PARTITION BY id ORDER BY seen) as prev_price,
    ROW_NUMBER() OVER (PARTITION BY id ORDER BY seen) as rn
  FROM auctions
)
SELECT 
  id, information, datacenter, location, cpu_vendor, cpu, cpu_count, is_highio,
  ram, ram_size, is_ecc, hdd_arr, nvme_count, nvme_drives, nvme_size,
  sata_count, sata_drives, sata_size, hdd_count, hdd_drives, hdd_size,
  with_inic, with_hwr, with_gpu, with_rps, traffic, bandwidth, price,
  fixed_price, seen
FROM PriceChanges
WHERE 
  -- Keep first occurrence of each auction
  rn = 1 
  -- Or keep if price changed from previous entry
  OR (prev_price IS NOT NULL AND price != prev_price);

-- Log cleanup stats
SELECT 
  (SELECT COUNT(*) FROM auctions) as before_count,
  (SELECT COUNT(*) FROM auctions_deduped) as after_count,
  ROUND(100.0 * (SELECT COUNT(*) FROM auctions_deduped) / (SELECT COUNT(*) FROM auctions), 1) as reduction_percent;

-- Replace original table
DROP TABLE auctions;
ALTER TABLE auctions_deduped RENAME TO auctions;

-- Recreate all constraints and indices
CREATE UNIQUE INDEX idx_unique_auction_entry ON auctions(id, price, seen);
CREATE INDEX idx_auctions_seen ON auctions(seen DESC);
CREATE INDEX idx_auctions_seen_location_cpu ON auctions(seen DESC, location, cpu_vendor);
CREATE INDEX idx_auctions_seen_price ON auctions(seen DESC, price);
CREATE INDEX idx_auctions_id_seen ON auctions(id, seen DESC);