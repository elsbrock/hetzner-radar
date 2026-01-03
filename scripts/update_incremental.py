#!/usr/bin/env python3
"""
Incremental DuckDB Update Script

Fetches current auction data from Hetzner API and incrementally updates the DuckDB database.
This eliminates the need for the data branch by directly updating the database.

Usage:
    python update_incremental.py <database_path>

Example:
    python update_incremental.py ../static/sb.duckdb.wasm
"""

import sys
import os
import duckdb
import multiprocessing
import urllib.request
import json
import gzip
from datetime import datetime

HETZNER_AUCTION_API_URL = "https://www.hetzner.com/_resources/app/data/app/live_data_sb_EUR.json"
HETZNER_LIVE_API_URL = "https://www.hetzner.com/_resources/app/data/app/live_data_en_EUR.json"

# Schema for the server table (new columns at end for backwards compat)
create_table_query = """
CREATE TABLE IF NOT EXISTS server (
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

    seen TIMESTAMP,

    server_type VARCHAR,

    -- New columns (added for standard server support)
    setup_price INTEGER DEFAULT 0,
    cpu_cores INTEGER,
    cpu_threads INTEGER,
    cpu_generation VARCHAR
);
"""

# Temp table for incoming data (matches main table schema)
create_temp_table_query = """
CREATE TEMP TABLE server_incoming (
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

    seen TIMESTAMP,

    server_type VARCHAR,

    setup_price INTEGER DEFAULT 0,
    cpu_cores INTEGER,
    cpu_threads INTEGER,
    cpu_generation VARCHAR
);
"""

# Transform and insert auction data from JSON
import_auction_query = """
INSERT INTO server_incoming
SELECT
    id,
    information,

    datacenter,
    CASE WHEN datacenter LIKE 'NBG%%' OR datacenter LIKE 'FSN%%'
        THEN 'Germany'
        ELSE 'Finland'
    END AS location,

    LEFT(cpu, POSITION(' ' IN cpu) - 1) as cpu_vendor,
    cpu,
    cpu_count,
    is_highio,

    ram,
    ram_size,
    is_ecc,

    hdd_arr,

    array_length(serverDiskData.nvme) as nvme_count,
    serverDiskData.nvme as nvme_drives,
    list_aggregate(serverDiskData.nvme, 'sum') as nvme_size,

    array_length(serverDiskData.sata) as sata_count,
    serverDiskData.sata as sata_drives,
    list_aggregate(serverDiskData.sata, 'sum') as sata_size,

    array_length(serverDiskData.hdd) as hdd_count,
    serverDiskData.hdd as hdd_drives,
    list_aggregate(serverDiskData.hdd, 'sum') as hdd_size,

    array_contains(specials, 'iNIC') as with_inic,
    array_contains(specials, 'HWR') as with_hwr,
    array_contains(specials, 'GPU') as with_gpu,
    array_contains(specials, 'RPS') as with_rps,

    traffic,
    bandwidth,

    price,
    fixed_price,

    TO_TIMESTAMP(next_reduce_timestamp - next_reduce)::timestamp as seen,

    'auction' as server_type,

    -- New columns (auctions have no setup fee, no detailed CPU info)
    0 as setup_price,
    NULL as cpu_cores,
    NULL as cpu_threads,
    NULL as cpu_generation

FROM read_json('%s', format = 'auto', columns = {
    id: 'UBIGINT',
    information: 'VARCHAR[]',
    cpu: 'VARCHAR',
    cpu_count: 'INTEGER',
    is_highio: 'BOOLEAN',
    traffic: 'VARCHAR',
    bandwidth: 'INTEGER',
    ram: 'VARCHAR',
    ram_size: 'INTEGER',
    price: 'INTEGER',
    hdd_arr: 'VARCHAR[]',
    serverDiskData: 'STRUCT(nvme INTEGER[], sata INTEGER[], hdd INTEGER[], general INTEGER[])',
    is_ecc: 'BOOLEAN',
    datacenter: 'VARCHAR',
    specials: 'VARCHAR[]',
    fixed_price: 'BOOLEAN',
    next_reduce_timestamp: 'INTEGER',
    next_reduce: 'INTEGER'
})
"""

# Insert all incoming data (deduplication happens after)
merge_query = """
INSERT INTO server
SELECT * FROM server_incoming
"""

# Deduplicate: keep only the latest record per auction per day
deduplicate_query = """
CREATE OR REPLACE TABLE server AS
WITH CTE AS (
    SELECT
        *,
        ROW_NUMBER() OVER (PARTITION BY id, date_trunc('d', seen) ORDER BY seen DESC) as row_num
    FROM
        server
)
SELECT * EXCLUDE row_num
FROM CTE
WHERE row_num = 1
"""

# Transform and insert standard (non-auction) server data directly into server table
# UNNEST creates one row per datacenter for each product
import_standard_query = """
INSERT INTO server
SELECT
    hash(s.id || '-' || dc.datacenter) as id,  -- Hash string ID + datacenter for uniqueness
    [s.name] as information,  -- Store product name (e.g. "AX41-NVMe") for linking

    dc.datacenter as datacenter,  -- Full datacenter (e.g. "HEL1", "FSN1", "NBG1")
    CASE WHEN dc.datacenter LIKE 'NBG%%' OR dc.datacenter LIKE 'FSN%%'
        THEN 'Germany'
        ELSE 'Finland'
    END AS location,

    LEFT(s.cpu, POSITION(' ' IN s.cpu || ' ') - 1) as cpu_vendor,
    s.cpu,
    s.cores as cpu_count,
    false as is_highio,

    s.ram_hr as ram,
    s.ram as ram_size,
    s.is_ecc,

    s.hdd_arr,

    array_length(s.serverDiskData.nvme) as nvme_count,
    s.serverDiskData.nvme as nvme_drives,
    list_aggregate(s.serverDiskData.nvme, 'sum') as nvme_size,

    array_length(s.serverDiskData.sata) as sata_count,
    s.serverDiskData.sata as sata_drives,
    list_aggregate(s.serverDiskData.sata, 'sum') as sata_size,

    array_length(s.serverDiskData.hdd) as hdd_count,
    s.serverDiskData.hdd as hdd_drives,
    list_aggregate(s.serverDiskData.hdd, 'sum') as hdd_size,

    array_contains(s.specials, 'iNIC') as with_inic,
    array_contains(s.specials, 'HWR') as with_hwr,
    array_contains(s.specials, 'GPU') as with_gpu,
    array_contains(s.specials, 'RPS') as with_rps,

    s.traffic,
    s."Bandwidth" as bandwidth,

    CAST(s.price - 1.70 AS INTEGER) as price,  -- Subtract IPv4 cost (added back by frontend)
    true as fixed_price,

    NOW() as seen,

    'standard' as server_type,

    -- New columns for standard servers
    s.setup_price,
    s.cores as cpu_cores,
    s.threads as cpu_threads,
    s.cpu_generation

FROM read_json('%s', format = 'auto', columns = {
    id: 'VARCHAR',
    name: 'VARCHAR',
    cpu: 'VARCHAR',
    cores: 'INTEGER',
    threads: 'INTEGER',
    cpu_generation: 'VARCHAR',
    ram: 'INTEGER',
    ram_hr: 'VARCHAR',
    is_ecc: 'BOOLEAN',
    hdd_arr: 'VARCHAR[]',
    serverDiskData: 'STRUCT(nvme INTEGER[], sata INTEGER[], hdd INTEGER[], general INTEGER[])',
    price: 'FLOAT',
    setup_price: 'INTEGER',
    "Bandwidth": 'INTEGER',
    traffic: 'VARCHAR',
    datacenter: 'STRUCT(datacenter VARCHAR, name VARCHAR, country VARCHAR, country_shortcode VARCHAR)[]',
    specials: 'VARCHAR[]'
}) s, LATERAL (SELECT UNNEST(s.datacenter) as dc) t
"""


def fetch_hetzner_data(url: str, output_path: str, label: str = "servers") -> str:
    """Fetch data from Hetzner API and save to temp file."""
    print(f"Fetching {label} from Hetzner API...")

    req = urllib.request.Request(
        url,
        headers={'User-Agent': 'Mozilla/5.0 (compatible; HetznerRadar/1.0)'}
    )

    with urllib.request.urlopen(req, timeout=30) as response:
        data = json.loads(response.read().decode('utf-8'))

    # Extract server array
    servers = data.get('server', data) if isinstance(data, dict) else data
    print(f"Fetched {len(servers)} {label} from API")

    # Save to temp file for DuckDB to read
    with open(output_path, 'w') as f:
        json.dump(servers, f)

    return output_path


def update_database(db_path: str, auction_json_path: str, standard_json_path: str = None, retention_days: int = 90):
    """Incrementally update the DuckDB database with new data."""
    print(f"Opening database: {db_path}")

    # Check if database exists
    db_exists = os.path.exists(db_path)

    conn = duckdb.connect(db_path, config={'threads': multiprocessing.cpu_count()})
    conn.execute("PRAGMA force_compression='dictionary'")

    try:
        conn.execute("BEGIN TRANSACTION")

        # Create main table if it doesn't exist
        if not db_exists:
            print("Creating new database...")
        conn.execute(create_table_query)

        # Migration: Add new columns if they don't exist (for existing databases)
        existing_columns = [row[0] for row in conn.execute("SELECT column_name FROM duckdb_columns() WHERE table_name = 'server'").fetchall()]

        migrations = [
            ('server_type', "ALTER TABLE server ADD COLUMN server_type VARCHAR DEFAULT 'auction'"),
            ('setup_price', "ALTER TABLE server ADD COLUMN setup_price INTEGER DEFAULT 0"),
            ('cpu_cores', "ALTER TABLE server ADD COLUMN cpu_cores INTEGER"),
            ('cpu_threads', "ALTER TABLE server ADD COLUMN cpu_threads INTEGER"),
            ('cpu_generation', "ALTER TABLE server ADD COLUMN cpu_generation VARCHAR"),
        ]

        for col_name, sql in migrations:
            if col_name not in existing_columns:
                print(f"Migrating: Adding {col_name} column...")
                conn.execute(sql)

        if any(col not in existing_columns for col, _ in migrations):
            print("Migration complete.")

        # Get current record count
        before_count = conn.execute("SELECT COUNT(*) FROM server").fetchone()[0]
        print(f"Existing records: {before_count}")

        # Create temp table for incoming data
        conn.execute(create_temp_table_query)

        # Import new auction data into temp table
        print("Importing new auction data...")
        conn.execute(import_auction_query % auction_json_path)

        incoming_count = conn.execute("SELECT COUNT(*) FROM server_incoming").fetchone()[0]
        print(f"Incoming records: {incoming_count}")

        # Merge new data (only insert if not already exists for this day)
        print("Merging new data...")
        conn.execute(merge_query)

        after_merge = conn.execute("SELECT COUNT(*) FROM server").fetchone()[0]
        new_records = after_merge - before_count
        print(f"New records added: {new_records}")

        # Deduplicate (in case of overlapping timestamps)
        print("Deduplicating...")
        conn.execute(deduplicate_query)

        after_dedup = conn.execute("SELECT COUNT(*) FROM server").fetchone()[0]
        print(f"Records after deduplication: {after_dedup}")

        # Purge old auction data (standard servers don't have history)
        if retention_days > 0:
            print(f"Purging auction records older than {retention_days} days...")
            conn.execute(f"""
                DELETE FROM server
                WHERE server_type = 'auction' AND seen < NOW() - INTERVAL '{retention_days} days'
            """)

            final_count = conn.execute("SELECT COUNT(*) FROM server").fetchone()[0]
            purged = after_dedup - final_count
            if purged > 0:
                print(f"Purged {purged} old records")

        # Update standard servers if path provided (fresh snapshot each time)
        if standard_json_path:
            print("\n--- Updating standard servers ---")
            # Delete existing standard servers (snapshot replacement)
            conn.execute("DELETE FROM server WHERE server_type = 'standard'")

            # Import fresh standard server data
            print("Importing standard server data...")
            conn.execute(import_standard_query % standard_json_path)

            standard_count = conn.execute("SELECT COUNT(*) FROM server WHERE server_type = 'standard'").fetchone()[0]
            print(f"Standard servers imported: {standard_count}")

        conn.execute("COMMIT")

        # Final stats
        final_count = conn.execute("SELECT COUNT(*) FROM server").fetchone()[0]
        auction_count = conn.execute("SELECT COUNT(*) FROM server WHERE server_type = 'auction'").fetchone()[0]
        standard_count = conn.execute("SELECT COUNT(*) FROM server WHERE server_type = 'standard'").fetchone()[0]
        date_range = conn.execute("""
            SELECT
                MIN(seen)::DATE as earliest,
                MAX(seen)::DATE as latest,
                COUNT(DISTINCT date_trunc('d', seen)) as days
            FROM server
            WHERE server_type = 'auction'
        """).fetchone()

        print(f"\nDatabase updated successfully!")
        print(f"Total records: {final_count} (auctions: {auction_count}, standard: {standard_count})")
        if date_range[0]:
            print(f"Auction date range: {date_range[0]} to {date_range[1]} ({date_range[2]} days)")

    except Exception as e:
        conn.execute("ROLLBACK")
        raise e
    finally:
        conn.close()


def print_usage():
    print("Usage: python update_incremental.py <database_path> [retention_days]")
    print("")
    print("Arguments:")
    print("  database_path   Path to the DuckDB database file")
    print("  retention_days  Number of days to keep (default: 90)")
    print("")
    print("Example:")
    print("  python update_incremental.py ../static/sb.duckdb.wasm 90")


def main():
    if len(sys.argv) < 2:
        print_usage()
        sys.exit(1)

    db_path = sys.argv[1]
    retention_days = int(sys.argv[2]) if len(sys.argv) > 2 else 90

    # Create temp files for JSON data
    temp_auction_json = "/tmp/hetzner_auction_data.json"
    temp_standard_json = "/tmp/hetzner_standard_data.json"

    try:
        # Fetch fresh data from Hetzner
        fetch_hetzner_data(HETZNER_AUCTION_API_URL, temp_auction_json, "auction servers")
        fetch_hetzner_data(HETZNER_LIVE_API_URL, temp_standard_json, "standard servers")

        # Update database incrementally
        update_database(db_path, temp_auction_json, temp_standard_json, retention_days)

    finally:
        # Cleanup temp files
        for temp_file in [temp_auction_json, temp_standard_json]:
            if os.path.exists(temp_file):
                os.remove(temp_file)


if __name__ == "__main__":
    main()
