-- Create a table to store only the current state of each auction
-- This dramatically reduces the data needed for alert matching

-- Table for current auction state (one row per auction)
CREATE TABLE IF NOT EXISTS current_auctions (
  id INTEGER PRIMARY KEY,
  information TEXT,
  datacenter TEXT NOT NULL,
  location TEXT NOT NULL,
  cpu_vendor TEXT NOT NULL,
  cpu TEXT NOT NULL,
  cpu_count INTEGER NOT NULL,
  is_highio BOOLEAN NOT NULL,
  ram TEXT NOT NULL,
  ram_size INTEGER NOT NULL,
  is_ecc BOOLEAN NOT NULL,
  hdd_arr TEXT NOT NULL,
  nvme_count INTEGER NOT NULL,
  nvme_drives TEXT NOT NULL,
  nvme_size INTEGER NOT NULL,
  sata_count INTEGER NOT NULL,
  sata_drives TEXT NOT NULL,
  sata_size INTEGER NOT NULL,
  hdd_count INTEGER NOT NULL,
  hdd_drives TEXT NOT NULL,
  hdd_size INTEGER NOT NULL,
  with_inic BOOLEAN NOT NULL,
  with_hwr BOOLEAN NOT NULL,
  with_gpu BOOLEAN NOT NULL,
  with_rps BOOLEAN NOT NULL,
  traffic TEXT NOT NULL,
  bandwidth INTEGER NOT NULL,
  price REAL NOT NULL,
  fixed_price BOOLEAN NOT NULL,
  seen TEXT NOT NULL,
  last_changed TEXT NOT NULL, -- When price or specs last changed
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indices for efficient querying
CREATE INDEX IF NOT EXISTS idx_current_auctions_location ON current_auctions(location);
CREATE INDEX IF NOT EXISTS idx_current_auctions_cpu_vendor ON current_auctions(cpu_vendor);
CREATE INDEX IF NOT EXISTS idx_current_auctions_price ON current_auctions(price);
CREATE INDEX IF NOT EXISTS idx_current_auctions_location_cpu_price ON current_auctions(location, cpu_vendor, price);

-- Table to track the latest batch timestamp
CREATE TABLE IF NOT EXISTS latest_batch (
  id INTEGER PRIMARY KEY CHECK (id = 1), -- Ensure only one row
  batch_time TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Insert initial row for latest_batch
INSERT OR IGNORE INTO latest_batch (id, batch_time) VALUES (1, datetime('now'));