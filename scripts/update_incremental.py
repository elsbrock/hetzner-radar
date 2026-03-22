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

# Minimum expected records to prevent uploading a corrupted/empty database
# This should be set to a reasonable minimum based on typical data volume
MIN_AUCTION_RECORDS = 50000  # ~50k auction records expected for 90 days
MIN_DAYS_OF_DATA = 30  # At least 30 days of data expected

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
    cpu_generation VARCHAR,

    -- CPU benchmark data (from Geekbench via cpu-specs.json)
    cpu_score INTEGER,
    cpu_multicore_score INTEGER
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
    cpu_generation VARCHAR,

    cpu_score INTEGER,
    cpu_multicore_score INTEGER
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

    -- New columns (auctions have no setup fee, CPU info filled by enrichment step)
    0 as setup_price,
    NULL as cpu_cores,
    NULL as cpu_threads,
    NULL as cpu_generation,
    NULL as cpu_score,
    NULL as cpu_multicore_score

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

    -- New columns for standard servers (scores filled by enrichment step)
    s.setup_price,
    s.cores as cpu_cores,
    s.threads as cpu_threads,
    s.cpu_generation,
    NULL as cpu_score,
    NULL as cpu_multicore_score

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


def load_cpu_specs() -> dict:
    """Load CPU specs from data/cpu-specs.json."""
    specs_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'cpu-specs.json')
    if not os.path.exists(specs_path):
        print(f"WARNING: CPU specs file not found at {specs_path}")
        return {}
    with open(specs_path) as f:
        return json.load(f)


def normalize_cpu_name(name: str) -> str:
    """Normalize a Hetzner CPU name for matching against cpu-specs.json keys."""
    import re
    # Remove '2x ' or '4x ' prefix (multi-socket)
    name = re.sub(r'^\d+x\s+', '', name)
    # Remove trademark symbols
    name = name.replace('®', '').replace('™', '')
    # Remove 'Prozessor' (German for processor)
    name = name.replace('Prozessor ', '')
    # Collapse whitespace and strip
    name = re.sub(r'\s+', ' ', name).strip()
    return name


def get_socket_count(raw_name: str) -> int:
    """Extract socket/CPU count from raw name (e.g. '2x Intel...' -> 2)."""
    import re
    match = re.match(r'^(\d+)x\s+', raw_name)
    return int(match.group(1)) if match else 1


def enrich_cpu_data(conn, cpu_specs: dict):
    """Enrich server records with CPU cores, threads, generation, and scores from cpu-specs.json."""
    if not cpu_specs:
        print("Skipping CPU enrichment (no specs available)")
        return

    # Get distinct CPU names that need enrichment
    rows = conn.execute("""
        SELECT DISTINCT cpu FROM server WHERE cpu_score IS NULL AND cpu IS NOT NULL
    """).fetchall()

    if not rows:
        print("No servers need CPU enrichment")
        return

    enriched = 0
    for (cpu_name,) in rows:
        normalized = normalize_cpu_name(cpu_name)
        specs = cpu_specs.get(normalized)
        if not specs:
            continue

        socket_count = get_socket_count(cpu_name)

        cores = specs['cores']
        threads = specs['threads']
        # For multi-socket, specs already has per-socket values multiplied
        # if the generator saw '2x' prefix. But if the raw name has '2x' and
        # the specs key is the normalized (non-2x) name, we need to multiply.
        # The generator stores already-multiplied values for 2x entries,
        # but here we match by normalized name (without 2x), so we multiply.
        if socket_count > 1:
            cores = specs['cores'] * socket_count
            threads = specs['threads'] * socket_count
            multicore_score = specs['multicore_score'] * socket_count
        else:
            cores = specs['cores']
            threads = specs['threads']
            multicore_score = specs['multicore_score']

        conn.execute("""
            UPDATE server SET
                cpu_cores = COALESCE(cpu_cores, ?),
                cpu_threads = COALESCE(cpu_threads, ?),
                cpu_generation = COALESCE(cpu_generation, ?),
                cpu_score = ?,
                cpu_multicore_score = ?
            WHERE cpu = ? AND cpu_score IS NULL
        """, [cores, threads, specs.get('family', ''), specs['score'], multicore_score, cpu_name])
        enriched += 1

    print(f"CPU enrichment: updated {enriched} distinct CPU models")


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


def validate_database(db_path: str) -> tuple[bool, str, dict]:
    """
    Validate that a database file is readable and contains expected data.

    Returns:
        tuple: (is_valid, error_message, stats_dict)
    """
    if not os.path.exists(db_path):
        return False, f"Database file does not exist: {db_path}", {}

    file_size = os.path.getsize(db_path)
    if file_size < 1000:  # Less than 1KB is definitely corrupt
        return False, f"Database file too small ({file_size} bytes), likely corrupted", {}

    try:
        conn = duckdb.connect(db_path, read_only=True)

        # Check if server table exists
        tables = [row[0] for row in conn.execute("SHOW TABLES").fetchall()]
        if 'server' not in tables:
            conn.close()
            return False, "Database missing 'server' table", {}

        # Get record counts and date range
        stats = conn.execute("""
            SELECT
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE server_type = 'auction') as auctions,
                COUNT(*) FILTER (WHERE server_type = 'standard') as standard,
                MIN(seen) FILTER (WHERE server_type = 'auction') as earliest,
                MAX(seen) FILTER (WHERE server_type = 'auction') as latest,
                COUNT(DISTINCT date_trunc('d', seen)) FILTER (WHERE server_type = 'auction') as days
            FROM server
        """).fetchone()

        conn.close()

        stats_dict = {
            'total': stats[0],
            'auctions': stats[1],
            'standard': stats[2],
            'earliest': stats[3],
            'latest': stats[4],
            'days': stats[5]
        }

        return True, "", stats_dict

    except Exception as e:
        return False, f"Failed to read database: {str(e)}", {}


def check_data_integrity(stats: dict, skip_threshold_check: bool = False) -> tuple[bool, str]:
    """
    Check if database has minimum expected data to prevent uploading empty/corrupt DB.

    Args:
        stats: Dictionary with database statistics
        skip_threshold_check: If True, skip minimum record/days checks (for initial setup)

    Returns:
        tuple: (passes_check, warning_message)
    """
    if skip_threshold_check:
        return True, ""

    warnings = []

    if stats.get('auctions', 0) < MIN_AUCTION_RECORDS:
        warnings.append(
            f"Auction records ({stats.get('auctions', 0)}) below minimum threshold ({MIN_AUCTION_RECORDS})"
        )

    if stats.get('days', 0) < MIN_DAYS_OF_DATA:
        warnings.append(
            f"Days of data ({stats.get('days', 0)}) below minimum threshold ({MIN_DAYS_OF_DATA})"
        )

    if warnings:
        return False, "; ".join(warnings)

    return True, ""


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
            ('cpu_score', "ALTER TABLE server ADD COLUMN cpu_score INTEGER"),
            ('cpu_multicore_score', "ALTER TABLE server ADD COLUMN cpu_multicore_score INTEGER"),
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

        # Enrich all servers with CPU specs (cores, threads, generation, scores)
        print("\n--- Enriching CPU data ---")
        cpu_specs = load_cpu_specs()
        enrich_cpu_data(conn, cpu_specs)

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
    print("Usage: python update_incremental.py <database_path> [retention_days] [--skip-threshold-check]")
    print("")
    print("Arguments:")
    print("  database_path          Path to the DuckDB database file")
    print("  retention_days         Number of days to keep (default: 90)")
    print("  --skip-threshold-check Skip minimum data checks (for initial setup)")
    print("")
    print("Example:")
    print("  python update_incremental.py ../static/sb.duckdb.wasm 90")


def main():
    if len(sys.argv) < 2:
        print_usage()
        sys.exit(1)

    db_path = sys.argv[1]
    retention_days = int(sys.argv[2]) if len(sys.argv) > 2 and not sys.argv[2].startswith('--') else 90
    skip_threshold_check = '--skip-threshold-check' in sys.argv

    # Create temp files for JSON data
    temp_auction_json = "/tmp/hetzner_auction_data.json"
    temp_standard_json = "/tmp/hetzner_standard_data.json"

    try:
        # Pre-flight validation: check if existing database is readable
        if os.path.exists(db_path):
            print("\n=== Pre-flight database validation ===")
            is_valid, error_msg, stats = validate_database(db_path)

            if not is_valid:
                print(f"WARNING: Existing database failed validation: {error_msg}")
                print("This may indicate a corrupted download. Proceeding with caution...")
                # Don't exit - we'll create/update and validate after
            else:
                print(f"Existing database OK: {stats['auctions']} auctions, {stats['days']} days of data")
        else:
            print(f"No existing database at {db_path}, will create new one")

        # Fetch fresh data from Hetzner
        fetch_hetzner_data(HETZNER_AUCTION_API_URL, temp_auction_json, "auction servers")
        fetch_hetzner_data(HETZNER_LIVE_API_URL, temp_standard_json, "standard servers")

        # Update database incrementally
        update_database(db_path, temp_auction_json, temp_standard_json, retention_days)

        # Post-update validation: verify database integrity before upload
        print("\n=== Post-update validation ===")
        is_valid, error_msg, stats = validate_database(db_path)

        if not is_valid:
            print(f"CRITICAL: Database validation failed after update: {error_msg}")
            print("Database may be corrupted. DO NOT UPLOAD.")
            sys.exit(2)  # Exit code 2 = validation failure

        passes_check, warning = check_data_integrity(stats, skip_threshold_check)

        if not passes_check:
            print(f"CRITICAL: Data integrity check failed: {warning}")
            print("Database has insufficient data. DO NOT UPLOAD.")
            print("Use --skip-threshold-check to override (for initial setup only)")
            sys.exit(2)  # Exit code 2 = validation failure

        print(f"Validation PASSED: {stats['auctions']} auctions, {stats['days']} days")
        print("Database is safe to upload.")

    finally:
        # Cleanup temp files
        for temp_file in [temp_auction_json, temp_standard_json]:
            if os.path.exists(temp_file):
                os.remove(temp_file)


if __name__ == "__main__":
    main()
