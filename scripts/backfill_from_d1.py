#!/usr/bin/env python3
"""
Backfill DuckDB from D1 Database

Exports auction data from Cloudflare D1 and imports it into the DuckDB database.
This is used to recover historical data after the DuckDB database was corrupted/reset.

Usage:
    python backfill_from_d1.py <database_path> [--days N]

Example:
    python backfill_from_d1.py ../static/sb.duckdb.wasm --days 90
"""

import sys
import os
import json
import subprocess
import duckdb
import multiprocessing
from datetime import datetime, timedelta

# Schema must match update_incremental.py
CREATE_TABLE_QUERY = """
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

    setup_price INTEGER DEFAULT 0,
    cpu_cores INTEGER,
    cpu_threads INTEGER,
    cpu_generation VARCHAR
);
"""


def run_wrangler_query(query: str, cwd: str) -> list:
    """Run a D1 query via wrangler and return results."""
    cmd = [
        "npx", "wrangler", "d1", "execute", "DB",
        "--command", query,
        "--remote", "--json"
    ]

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        cwd=cwd
    )

    if result.returncode != 0:
        print(f"Wrangler error: {result.stderr}")
        raise Exception(f"Wrangler query failed: {result.stderr}")

    # Parse JSON output - wrangler outputs JSON array
    try:
        output = json.loads(result.stdout)
        if isinstance(output, list) and len(output) > 0:
            return output[0].get("results", [])
        return []
    except json.JSONDecodeError as e:
        # Try to extract JSON from output (wrangler may have extra output)
        lines = result.stdout.strip().split('\n')
        for line in lines:
            if line.startswith('['):
                output = json.loads(line)
                if isinstance(output, list) and len(output) > 0:
                    return output[0].get("results", [])
        raise e


def parse_json_array(value):
    """Parse a JSON array string into a Python list."""
    if value is None:
        return None
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return None
    return None


def transform_row(row: dict) -> dict:
    """Transform a D1 row to DuckDB format."""
    return {
        'id': row['id'],
        'information': parse_json_array(row.get('information')),
        'datacenter': row.get('datacenter'),
        'location': row.get('location'),
        'cpu_vendor': row.get('cpu_vendor'),
        'cpu': row.get('cpu'),
        'cpu_count': row.get('cpu_count'),
        'is_highio': bool(row.get('is_highio')),
        'ram': row.get('ram'),
        'ram_size': row.get('ram_size'),
        'is_ecc': bool(row.get('is_ecc')),
        'hdd_arr': parse_json_array(row.get('hdd_arr')),
        'nvme_count': row.get('nvme_count'),
        'nvme_drives': parse_json_array(row.get('nvme_drives')),
        'nvme_size': row.get('nvme_size'),
        'sata_count': row.get('sata_count'),
        'sata_drives': parse_json_array(row.get('sata_drives')),
        'sata_size': row.get('sata_size'),
        'hdd_count': row.get('hdd_count'),
        'hdd_drives': parse_json_array(row.get('hdd_drives')),
        'hdd_size': row.get('hdd_size'),
        'with_inic': bool(row.get('with_inic')),
        'with_hwr': bool(row.get('with_hwr')),
        'with_gpu': bool(row.get('with_gpu')),
        'with_rps': bool(row.get('with_rps')),
        'traffic': row.get('traffic'),
        'bandwidth': row.get('bandwidth'),
        'price': row.get('price'),
        'fixed_price': bool(row.get('fixed_price')),
        'seen': row.get('seen'),
        'server_type': 'auction',
        'setup_price': 0,
        'cpu_cores': None,
        'cpu_threads': None,
        'cpu_generation': None,
    }


def export_d1_data(worker_dir: str, days: int = 90) -> list:
    """Export auction data from D1 in batches."""
    cutoff_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')

    # First, get total count
    count_query = f"SELECT COUNT(*) as cnt FROM auctions WHERE seen >= '{cutoff_date}'"
    count_result = run_wrangler_query(count_query, worker_dir)
    total_count = count_result[0]['cnt'] if count_result else 0
    print(f"Total records to export: {total_count}")

    if total_count == 0:
        return []

    # Export in batches
    batch_size = 10000
    all_rows = []
    offset = 0

    while offset < total_count:
        print(f"Exporting batch {offset // batch_size + 1} ({offset}/{total_count})...")
        query = f"""
            SELECT * FROM auctions
            WHERE seen >= '{cutoff_date}'
            ORDER BY seen ASC
            LIMIT {batch_size} OFFSET {offset}
        """

        rows = run_wrangler_query(query, worker_dir)
        if not rows:
            break

        all_rows.extend(rows)
        offset += batch_size
        print(f"  Fetched {len(rows)} rows")

    print(f"Total rows exported: {len(all_rows)}")
    return all_rows


def import_to_duckdb(db_path: str, rows: list):
    """Import rows into DuckDB database."""
    print(f"Opening database: {db_path}")

    conn = duckdb.connect(db_path, config={'threads': multiprocessing.cpu_count()})
    conn.execute("PRAGMA force_compression='dictionary'")

    try:
        conn.execute("BEGIN TRANSACTION")

        # Create table if not exists
        conn.execute(CREATE_TABLE_QUERY)

        # Add server_type column if missing (migration)
        existing_columns = [row[0] for row in conn.execute(
            "SELECT column_name FROM duckdb_columns() WHERE table_name = 'server'"
        ).fetchall()]

        if 'server_type' not in existing_columns:
            print("Migrating: Adding server_type column...")
            conn.execute("ALTER TABLE server ADD COLUMN server_type VARCHAR DEFAULT 'auction'")

        # Get existing record count
        before_count = conn.execute("SELECT COUNT(*) FROM server WHERE server_type = 'auction'").fetchone()[0]
        print(f"Existing auction records: {before_count}")

        # Transform and insert rows
        print("Transforming and inserting rows...")
        transformed = [transform_row(row) for row in rows]

        # Create temp table and insert
        conn.execute("""
            CREATE TEMP TABLE backfill_incoming (
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
                setup_price INTEGER,
                cpu_cores INTEGER,
                cpu_threads INTEGER,
                cpu_generation VARCHAR
            )
        """)

        # Insert in batches
        batch_size = 5000
        for i in range(0, len(transformed), batch_size):
            batch = transformed[i:i+batch_size]
            conn.executemany("""
                INSERT INTO backfill_incoming VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                )
            """, [
                (
                    r['id'], r['information'], r['datacenter'], r['location'],
                    r['cpu_vendor'], r['cpu'], r['cpu_count'], r['is_highio'],
                    r['ram'], r['ram_size'], r['is_ecc'], r['hdd_arr'],
                    r['nvme_count'], r['nvme_drives'], r['nvme_size'],
                    r['sata_count'], r['sata_drives'], r['sata_size'],
                    r['hdd_count'], r['hdd_drives'], r['hdd_size'],
                    r['with_inic'], r['with_hwr'], r['with_gpu'], r['with_rps'],
                    r['traffic'], r['bandwidth'], r['price'], r['fixed_price'],
                    r['seen'], r['server_type'], r['setup_price'],
                    r['cpu_cores'], r['cpu_threads'], r['cpu_generation']
                )
                for r in batch
            ])
            print(f"  Inserted batch {i // batch_size + 1}")

        # Merge: insert only new records (not already in server table)
        print("Merging new data...")
        conn.execute("""
            INSERT INTO server
            SELECT b.* FROM backfill_incoming b
            WHERE NOT EXISTS (
                SELECT 1 FROM server s
                WHERE s.id = b.id
                AND date_trunc('d', s.seen) = date_trunc('d', b.seen)
            )
        """)

        # Deduplicate
        print("Deduplicating...")
        conn.execute("""
            CREATE OR REPLACE TABLE server AS
            WITH CTE AS (
                SELECT
                    *,
                    ROW_NUMBER() OVER (PARTITION BY id, date_trunc('d', seen) ORDER BY seen DESC) as row_num
                FROM server
            )
            SELECT * EXCLUDE row_num
            FROM CTE
            WHERE row_num = 1
        """)

        conn.execute("COMMIT")

        # Final stats
        final_count = conn.execute("SELECT COUNT(*) FROM server WHERE server_type = 'auction'").fetchone()[0]
        new_records = final_count - before_count
        print(f"\nBackfill complete!")
        print(f"New records added: {new_records}")
        print(f"Total auction records: {final_count}")

        date_range = conn.execute("""
            SELECT
                MIN(seen)::DATE as earliest,
                MAX(seen)::DATE as latest,
                COUNT(DISTINCT date_trunc('d', seen)) as days
            FROM server
            WHERE server_type = 'auction'
        """).fetchone()

        if date_range[0]:
            print(f"Date range: {date_range[0]} to {date_range[1]} ({date_range[2]} days)")

    except Exception as e:
        conn.execute("ROLLBACK")
        raise e
    finally:
        conn.close()


def print_usage():
    print("Usage: python backfill_from_d1.py <database_path> [--days N]")
    print("")
    print("Arguments:")
    print("  database_path   Path to the DuckDB database file")
    print("  --days N        Number of days of history to import (default: 90)")
    print("")
    print("Example:")
    print("  python backfill_from_d1.py ../static/sb.duckdb.wasm --days 90")


def main():
    if len(sys.argv) < 2:
        print_usage()
        sys.exit(1)

    db_path = sys.argv[1]
    days = 90

    # Parse --days argument
    if '--days' in sys.argv:
        idx = sys.argv.index('--days')
        if idx + 1 < len(sys.argv):
            days = int(sys.argv[idx + 1])

    # Find worker directory (for wrangler)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    worker_dir = os.path.join(script_dir, '..', 'worker')

    if not os.path.exists(os.path.join(worker_dir, 'wrangler.jsonc')):
        print(f"Error: Could not find wrangler.jsonc in {worker_dir}")
        sys.exit(1)

    print(f"Backfilling {days} days of data from D1 to {db_path}")
    print(f"Using wrangler from: {worker_dir}")
    print("")

    # Export from D1
    rows = export_d1_data(worker_dir, days)

    if not rows:
        print("No data to import")
        sys.exit(0)

    # Import to DuckDB
    import_to_duckdb(db_path, rows)


if __name__ == "__main__":
    main()
