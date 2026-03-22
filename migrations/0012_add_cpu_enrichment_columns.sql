-- Add CPU enrichment columns to both auction tables
-- Data populated from Geekbench via cpu-specs.json

ALTER TABLE current_auctions ADD COLUMN cpu_cores INTEGER;
ALTER TABLE current_auctions ADD COLUMN cpu_threads INTEGER;
ALTER TABLE current_auctions ADD COLUMN cpu_generation TEXT;
ALTER TABLE current_auctions ADD COLUMN cpu_score INTEGER;
ALTER TABLE current_auctions ADD COLUMN cpu_multicore_score INTEGER;

ALTER TABLE auctions ADD COLUMN cpu_cores INTEGER;
ALTER TABLE auctions ADD COLUMN cpu_threads INTEGER;
ALTER TABLE auctions ADD COLUMN cpu_generation TEXT;
ALTER TABLE auctions ADD COLUMN cpu_score INTEGER;
ALTER TABLE auctions ADD COLUMN cpu_multicore_score INTEGER;
