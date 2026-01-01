import { parquetWriteBuffer } from "hyparquet-writer";
import duckdb from "duckdb";
import { writeFileSync } from "fs";

// Sample auction data (mimics what worker would produce)
const sampleAuctions = [
  {
    id: 1234567,
    cpu: "Intel Core i7-6700",
    cpu_vendor: "Intel",
    cpu_count: 8,
    ram_size: 64,
    is_ecc: false,
    nvme_size: 0,
    sata_size: 0,
    hdd_size: 4000,
    datacenter: "FSN1-DC14",
    location: "Germany",
    price: 34.5,
    seen: "2024-01-15T10:30:00Z",
  },
  {
    id: 1234568,
    cpu: "AMD Ryzen 5 3600",
    cpu_vendor: "AMD",
    cpu_count: 12,
    ram_size: 128,
    is_ecc: true,
    nvme_size: 1000,
    sata_size: 0,
    hdd_size: 0,
    datacenter: "HEL1-DC2",
    location: "Finland",
    price: 52.0,
    seen: "2024-01-15T10:30:00Z",
  },
  {
    id: 1234569,
    cpu: "Intel Xeon E3-1275v6",
    cpu_vendor: "Intel",
    cpu_count: 8,
    ram_size: 64,
    is_ecc: true,
    nvme_size: 500,
    sata_size: 2000,
    hdd_size: 0,
    datacenter: "NBG1-DC3",
    location: "Germany",
    price: 45.0,
    seen: "2024-01-15T10:35:00Z",
  },
];

console.log("=== Parquet + DuckDB POC ===\n");

// Step 1: Convert to columnar format for parquet
console.log("1. Converting row data to columnar format...");
const columnData = [
  { name: "id", data: sampleAuctions.map((a) => BigInt(a.id)), type: "INT64" },
  { name: "cpu", data: sampleAuctions.map((a) => a.cpu), type: "STRING" },
  {
    name: "cpu_vendor",
    data: sampleAuctions.map((a) => a.cpu_vendor),
    type: "STRING",
  },
  {
    name: "cpu_count",
    data: sampleAuctions.map((a) => a.cpu_count),
    type: "INT32",
  },
  {
    name: "ram_size",
    data: sampleAuctions.map((a) => a.ram_size),
    type: "INT32",
  },
  {
    name: "is_ecc",
    data: sampleAuctions.map((a) => a.is_ecc),
    type: "BOOLEAN",
  },
  {
    name: "nvme_size",
    data: sampleAuctions.map((a) => a.nvme_size),
    type: "INT32",
  },
  {
    name: "sata_size",
    data: sampleAuctions.map((a) => a.sata_size),
    type: "INT32",
  },
  {
    name: "hdd_size",
    data: sampleAuctions.map((a) => a.hdd_size),
    type: "INT32",
  },
  {
    name: "datacenter",
    data: sampleAuctions.map((a) => a.datacenter),
    type: "STRING",
  },
  {
    name: "location",
    data: sampleAuctions.map((a) => a.location),
    type: "STRING",
  },
  { name: "price", data: sampleAuctions.map((a) => a.price), type: "DOUBLE" },
  { name: "seen", data: sampleAuctions.map((a) => a.seen), type: "STRING" },
];

// Step 2: Write to Parquet buffer
console.log("2. Writing Parquet buffer...");
const parquetBuffer = parquetWriteBuffer({ columnData });
console.log(`   Buffer size: ${parquetBuffer.byteLength} bytes`);

// Step 3: Save to file (simulates R2 upload)
const filename = "test-auctions.parquet";
writeFileSync(filename, Buffer.from(parquetBuffer));
console.log(`   Saved to ${filename}`);

// Step 4: Read with DuckDB
console.log("\n3. Reading with DuckDB...");
const db = new duckdb.Database(":memory:");
const conn = db.connect();

// Query the parquet file
conn.all(`SELECT * FROM read_parquet('${filename}')`, (err, rows) => {
  if (err) {
    console.error("Error reading parquet:", err);
    return;
  }

  console.log(`   Read ${rows.length} rows from parquet file\n`);
  console.log("4. Query results:");
  console.table(rows);

  // Test some analytical queries
  console.log("\n5. Testing analytical queries...");

  conn.all(
    `
    SELECT
      cpu_vendor,
      COUNT(*) as count,
      AVG(price) as avg_price,
      MIN(price) as min_price
    FROM read_parquet('${filename}')
    GROUP BY cpu_vendor
  `,
    (err, stats) => {
      if (err) {
        console.error("Error:", err);
        return;
      }
      console.log("\n   Price stats by CPU vendor:");
      console.table(stats);

      // Test reading multiple files (simulate manifest approach)
      console.log("\n6. Testing multi-file read (manifest approach)...");

      // Create a second parquet file with different data
      const moreAuctions = [
        {
          id: 1234570,
          cpu: "AMD Ryzen 7 5800X",
          cpu_vendor: "AMD",
          cpu_count: 16,
          ram_size: 256,
          is_ecc: true,
          nvme_size: 2000,
          sata_size: 0,
          hdd_size: 0,
          datacenter: "FSN1-DC18",
          location: "Germany",
          price: 89.0,
          seen: "2024-01-16T08:00:00Z",
        },
      ];

      const columnData2 = [
        {
          name: "id",
          data: moreAuctions.map((a) => BigInt(a.id)),
          type: "INT64",
        },
        { name: "cpu", data: moreAuctions.map((a) => a.cpu), type: "STRING" },
        {
          name: "cpu_vendor",
          data: moreAuctions.map((a) => a.cpu_vendor),
          type: "STRING",
        },
        {
          name: "cpu_count",
          data: moreAuctions.map((a) => a.cpu_count),
          type: "INT32",
        },
        {
          name: "ram_size",
          data: moreAuctions.map((a) => a.ram_size),
          type: "INT32",
        },
        {
          name: "is_ecc",
          data: moreAuctions.map((a) => a.is_ecc),
          type: "BOOLEAN",
        },
        {
          name: "nvme_size",
          data: moreAuctions.map((a) => a.nvme_size),
          type: "INT32",
        },
        {
          name: "sata_size",
          data: moreAuctions.map((a) => a.sata_size),
          type: "INT32",
        },
        {
          name: "hdd_size",
          data: moreAuctions.map((a) => a.hdd_size),
          type: "INT32",
        },
        {
          name: "datacenter",
          data: moreAuctions.map((a) => a.datacenter),
          type: "STRING",
        },
        {
          name: "location",
          data: moreAuctions.map((a) => a.location),
          type: "STRING",
        },
        {
          name: "price",
          data: moreAuctions.map((a) => a.price),
          type: "DOUBLE",
        },
        { name: "seen", data: moreAuctions.map((a) => a.seen), type: "STRING" },
      ];

      const parquetBuffer2 = parquetWriteBuffer({ columnData: columnData2 });
      writeFileSync("test-auctions-2.parquet", Buffer.from(parquetBuffer2));
      console.log("   Created second parquet file");

      // Read both files at once (like manifest would do)
      conn.all(
        `
      SELECT * FROM read_parquet(['test-auctions.parquet', 'test-auctions-2.parquet'])
      ORDER BY seen
    `,
        (err, combined) => {
          if (err) {
            console.error("Error:", err);
            return;
          }
          console.log(
            `\n   Combined read: ${combined.length} total rows from 2 files`,
          );
          console.table(combined);

          console.log("\n=== POC Complete ===");
          console.log("\nKey findings:");
          console.log("- hyparquet-writer creates valid Parquet files");
          console.log("- DuckDB can read them without issues");
          console.log("- Multi-file reads work (manifest approach viable)");
          console.log(
            `- File size efficient: ${parquetBuffer.byteLength} bytes for ${sampleAuctions.length} rows`,
          );

          // Cleanup
          conn.close();
          db.close();
        },
      );
    },
  );
});
