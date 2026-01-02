import sys
import duckdb
import multiprocessing

create_table_query = """
CREATE TEMP TABLE server_raw (
    id UBIGINT,
    server_type VARCHAR,
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
"""

import_data_query = """
insert into server_raw
  select
    id,
    'auction' as server_type,
    information,

    datacenter,
    case WHEN datacenter LIKE 'NBG%%' OR datacenter LIKE 'FSN%%'
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
    list_aggregate(serverDiskData.nvme, 'sum') as nvm_size,

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
    
    TO_TIMESTAMP(next_reduce_timestamp - next_reduce)::timestamp as seen

  from read_json('%s', format = 'auto', columns = {
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

remove_duplicates_query = """
CREATE OR REPLACE TABLE server AS
WITH CTE AS (
    SELECT
        *,
        ROW_NUMBER() OVER (PARTITION BY id, date_trunc('d', seen) ORDER BY seen DESC) as row_num
    FROM
        server_raw
)
SELECT * exclude row_num
FROM CTE
WHERE row_num = 1
"""

def print_usage():
    print("Usage: python import_to_duckdb.py <folder> <database_name>")

def import_json_files(folder, db_name):
    conn = duckdb.connect(db_name, config = {'threads': multiprocessing.cpu_count()})
    conn.execute("PRAGMA force_compression='dictionary'")
    conn.execute("begin transaction")
    conn.execute(create_table_query)
    print("importing data")
    conn.execute(import_data_query % (folder + "/**/*.json.gz"))
    print("removing duplicates")
    conn.execute(remove_duplicates_query)
    print("creating index")
    #conn.execute("create unique index server_idx on server (id, next_reduce_timestamp)")
    conn.execute("commit")
    print(conn.sql("select count(*) as num_records from server"))
    conn.close()

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print_usage()
    else:
        import_json_files(sys.argv[1], sys.argv[2])
