-- Migration number: 0001 	 2024-11-03T18:56:11.969Z

CREATE TABLE IF NOT EXISTS user (
    id TEXT NOT NULL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_user_email ON user(email);

CREATE TABLE IF NOT EXISTS session (
    id TEXT NOT NULL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    expires_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS email_verification_code (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL,
    email TEXT NOT NULL,
    expires_at DATETIME NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_verification_email ON email_verification_code(email);
CREATE INDEX IF NOT EXISTS idx_verification_code ON email_verification_code(code);

CREATE TABLE IF NOT EXISTS price_alert (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    filter TEXT NOT NULL,
    price INTEGER NOT NULL,
    user_id INTEGER NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_price_alert_user_id_filter ON price_alert(user_id, filter);
CREATE UNIQUE INDEX IF NOT EXISTS idx_price_alert_user_id_name ON price_alert(user_id, name);
CREATE INDEX IF NOT EXISTS idx_alert_filter ON price_alert(filter);

CREATE TABLE IF NOT EXISTS price_alert_history (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    filter TEXT NOT NULL,
    price INTEGER NOT NULL,
    trigger_price INTEGER NOT NULL,
    user_id INTEGER NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    created_at DATETIME NOT NULL,
    triggered_at DATETIME NOT NULL
);

-- this is a staging table for the alerting feature - D1 does not support
-- temporary tables, so instead we use a real table but we never commit to it
CREATE TABLE IF NOT EXISTS temp_servers_staging (
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
