-- Migration number: 0004 2025-05-02T11:01:32.000Z

CREATE TABLE IF NOT EXISTS auctions (
    id UBIGINT,
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_auction_entry ON auctions(id, price, seen);
