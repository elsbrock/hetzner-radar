-- Migration number: 0002    2025-01-30T00:00:00.000Z

CREATE TABLE IF NOT EXISTS servers (
    id UBIGINT PRIMARY KEY,
    information VARCHAR[],
    datacenter VARCHAR,
    location VARCHAR,
    cpu_vendor VARCHAR,
    cpu VARCHAR,
    cpu_count INTEGER,
    is_highio BOOLEAN,
    ram VARCHAR,
    ram_size INTEGER,
    is_ecc BOOLEAN,
    hdd_arr VARCHAR[],
    nvme_count INTEGER,
    nvme_drives INTEGER[],
    nvme_size INTEGER,
    sata_count INTEGER,
    sata_drives INTEGER[],
    sata_size INTEGER,
    hdd_count INTEGER,
    hdd_drives INTEGER[],
    hdd_size INTEGER,
    with_inic BOOLEAN,
    with_hwr BOOLEAN,
    with_gpu BOOLEAN,
    with_rps BOOLEAN,
    traffic VARCHAR,
    bandwidth INTEGER,
    price INTEGER,
    fixed_price BOOLEAN,
    seen TIMESTAMP
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_servers_price ON servers(price);
CREATE INDEX IF NOT EXISTS idx_servers_location ON servers(location);
CREATE INDEX IF NOT EXISTS idx_servers_cpu_vendor ON servers(cpu_vendor);
