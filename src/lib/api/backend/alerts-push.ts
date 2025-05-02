import { HETZNER_IPV4_COST_CENTS } from '$lib/constants';
import { sendMail } from "$lib/mail";

// Define the structure for the incoming raw server data
export interface RawServerData {
  id: number;
  information: string | null;
  datacenter: string;
  location: string;
  cpu_vendor: string;
  cpu: string;
  cpu_count: number;
  is_highio: boolean;
  ram: string; // Assuming RAM description like '4x 16GB DDR4'
  ram_size: number;
  is_ecc: boolean;
  hdd_arr: string; // JSON string array like '["2x 480GB NVMe"]'
  nvme_count: number;
  nvme_drives: string; // JSON string array like '[480, 480]'
  nvme_size: number;
  sata_count: number;
  sata_drives: string; // JSON string array
  sata_size: number;
  hdd_count: number;
  hdd_drives: string; // JSON string array
  hdd_size: number;
  with_inic: boolean;
  with_hwr: boolean;
  with_gpu: boolean;
  with_rps: boolean;
  traffic: string;
  bandwidth: number;
  price: number;
  fixed_price: boolean;
  seen: string; // ISO date string
}

// Database column names for server data
export const SERVER_COLUMNS = [
  'id', 'information', 'datacenter', 'location', 'cpu_vendor', 'cpu', 'cpu_count', 'is_highio',
  'ram', 'ram_size', 'is_ecc', 'hdd_arr', 'nvme_count', 'nvme_drives', 'nvme_size',
  'sata_count', 'sata_drives', 'sata_size', 'hdd_count', 'hdd_drives', 'hdd_size',
  'with_inic', 'with_hwr', 'with_gpu', 'with_rps', 'traffic', 'bandwidth', 'price',
  'fixed_price', 'seen'
];

// SQL query to insert data into the auctions table
export const AUCTIONS_INSERT_SQL = `
  INSERT OR IGNORE INTO auctions (${SERVER_COLUMNS.join(', ')})
  VALUES (${SERVER_COLUMNS.map(() => '?').join(', ')})
`;

// SQL query to find matching alerts for the current server data
export const MATCH_ALERTS_SQL = `
  WITH ConfigWithDriveStats AS (
      SELECT
          c.*,
          -- Compute min and max for HDD drives
          (SELECT MIN(value) FROM json_each(c.hdd_drives)) AS min_hdd_drive,
          (SELECT MAX(value) FROM json_each(c.hdd_drives)) AS max_hdd_drive,

          -- Compute min and max for NVMe drives
          (SELECT MIN(value) FROM json_each(c.nvme_drives)) AS min_nvme_drive,
          (SELECT MAX(value) FROM json_each(c.nvme_drives)) AS max_nvme_drive,

          -- Compute min and max for SATA drives
          (SELECT MIN(value) FROM json_each(c.sata_drives)) AS min_sata_drive,
          (SELECT MAX(value) FROM json_each(c.sata_drives)) AS max_sata_drive
      FROM
          auctions c
      WHERE
          -- Only consider auctions that were just inserted (latest batch)
          c.seen = (SELECT MAX(seen) FROM auctions)
  )

  SELECT 
      pa.id AS alert_id,
      pa.name,
      pa.price,
      pa.vat_rate,
      pa.user_id,
      pa.includes_ipv4_cost,
      user.email,
      pa.created_at,
      pa.filter,
      c.id AS auction_id,
      c.price AS auction_price
  FROM
      price_alert pa
  JOIN
      ConfigWithDriveStats c
  ON
      1 = 1  -- Cross join; all filtering is handled in WHERE
  INNER JOIN
      user
  ON
      pa.user_id = user.id
  WHERE
      -- Price Conditions
      pa.price >= (c.price + (CASE WHEN pa.includes_ipv4_cost = 1 THEN ${HETZNER_IPV4_COST_CENTS/100} ELSE 0 END)) * (1 + pa.vat_rate / 100.0)

      -- Location Conditions: ORed appropriately
      AND (
          (
              json_extract(pa.filter, '$.locationGermany') = 1
              AND c.location = 'Germany'
          )
          OR
          (
              json_extract(pa.filter, '$.locationFinland') = 1
              AND c.location = 'Finland'
          )
      )

      -- CPU Count
      AND c.cpu_count >= json_extract(pa.filter, '$.cpuCount')

      -- CPU Vendor Conditions: ORed appropriately
      AND (
          (
              json_extract(pa.filter, '$.cpuIntel') = 1
              AND c.cpu_vendor = 'Intel'
          )
          OR
          (
              json_extract(pa.filter, '$.cpuAMD') = 1
              AND c.cpu_vendor = 'AMD'
          )
      )

      -- RAM Internal Size (log2 transformation)
      AND (
          json_extract(pa.filter, '$.ramInternalSize[0]') <= (ln(c.ram_size) / ln(2))
          AND (ln(c.ram_size) / ln(2)) <= json_extract(pa.filter, '$.ramInternalSize[1]')
      )

      -- NVMe SSD Count
      AND c.nvme_count BETWEEN json_extract(pa.filter, '$.ssdNvmeCount[0]') AND json_extract(pa.filter, '$.ssdNvmeCount[1]')

      -- NVMe SSD Internal Size
      AND (
        json_extract(pa.filter, '$.ssdNvmeCount[0]') = 0
        OR (
            json_extract(pa.filter, '$.ssdNvmeInternalSize[0]') <=
                COALESCE(FLOOR(c.min_nvme_drive / 250.0), 0)
            AND
                (FLOOR(c.max_nvme_drive / 250.0) + CASE WHEN (c.max_nvme_drive / 250.0) > FLOOR(c.max_nvme_drive / 250.0) THEN 1 ELSE 0 END)
                <= json_extract(pa.filter, '$.ssdNvmeInternalSize[1]')
          )
      )

      -- SATA SSD Count
      AND c.sata_count BETWEEN json_extract(pa.filter, '$.ssdSataCount[0]') AND json_extract(pa.filter, '$.ssdSataCount[1]')

      -- SATA SSD Internal Size
      AND (
        json_extract(pa.filter, '$.ssdSataCount[0]') = 0
        OR (
            json_extract(pa.filter, '$.ssdSataInternalSize[0]') <=
                COALESCE(FLOOR(c.min_sata_drive / 250.0), 0)
            AND
                (FLOOR(c.max_sata_drive / 250.0) + CASE WHEN (c.max_sata_drive / 250.0) > FLOOR(c.max_sata_drive / 250.0) THEN 1 ELSE 0 END)
                <= json_extract(pa.filter, '$.ssdSataInternalSize[1]')
        )
      )

      -- HDD Count
      AND c.hdd_count BETWEEN json_extract(pa.filter, '$.hddCount[0]') AND json_extract(pa.filter, '$.hddCount[1]')

      -- HDD Internal Size
      AND (
        json_extract(pa.filter, '$.hddCount[0]') = 0
        OR (
            json_extract(pa.filter, '$.hddInternalSize[0]') <=
                COALESCE(FLOOR(c.min_hdd_drive / 500.0), 0)
            AND
                (FLOOR(c.max_hdd_drive / 500.0) + CASE WHEN (c.max_hdd_drive / 500.0) > FLOOR(c.max_hdd_drive / 500.0) THEN 1 ELSE 0 END)
                <= json_extract(pa.filter, '$.hddInternalSize[1]')
        )
      )

      -- Selected Datacenters
      AND (
          json_type(pa.filter, '$.selectedDatacenters') = 'null'
          OR json_array_length(json_extract(pa.filter, '$.selectedDatacenters')) = 0
          OR c.datacenter IN (
              SELECT value FROM json_each(pa.filter, '$.selectedDatacenters')
          )
      )

      -- Selected CPU Models (Comparing c.cpu instead of c.cpu_vendor)
      AND (
          json_type(pa.filter, '$.selectedCpuModels') = 'null'
          OR json_array_length(json_extract(pa.filter, '$.selectedCpuModels')) = 0
          OR c.cpu IN (
              SELECT value FROM json_each(pa.filter, '$.selectedCpuModels')
          )
      )

      -- Extras: ECC
      AND (
          json_type(pa.filter, '$.extrasECC') = 'null'
          OR json_extract(pa.filter, '$.extrasECC') = c.is_ecc
      )

      -- Extras: INIC
      AND (
          json_type(pa.filter, '$.extrasINIC') = 'null'
          OR json_extract(pa.filter, '$.extrasINIC') = c.with_inic
      )

      -- Extras: HWR
      AND (
          json_type(pa.filter, '$.extrasHWR') = 'null'
          OR json_extract(pa.filter, '$.extrasHWR') = c.with_hwr
      )

      -- Extras: GPU
      AND (
          json_type(pa.filter, '$.extrasGPU') = 'null'
          OR json_extract(pa.filter, '$.extrasGPU') = c.with_gpu
      )

      -- Extras: RPS
      AND (
          json_type(pa.filter, '$.extrasRPS') = 'null'
          OR json_extract(pa.filter, '$.extrasRPS') = c.with_rps
      )
`;

// SQL query to insert data into the price_alert_history table
export const ALERT_HISTORY_INSERT_SQL = `
  INSERT INTO price_alert_history (id, name, filter, price, vat_rate, trigger_price, user_id, created_at, triggered_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, current_timestamp)
`;

// SQL query to delete a processed alert
export const ALERT_DELETE_SQL = `DELETE FROM price_alert WHERE id = ?`;

// SQL query to insert data into the alert_auction_matches table
export const ALERT_AUCTION_MATCHES_INSERT_SQL = `
  INSERT INTO alert_auction_matches (alert_history_id, auction_id, match_price)
  VALUES (?, ?, ?)
`;

/**
 * Prepares server data for database insertion
 */
export async function prepareServerData(db: DB, configs: RawServerData[]): Promise<PreparedStatement[]> {
  const auctionStmt = db.prepare(AUCTIONS_INSERT_SQL);
  const auctionBatch: PreparedStatement[] = [];
  
  for (const config of configs) {
    const boundData = [
      config.id,
      config.information,
      config.datacenter,
      config.location,
      config.cpu_vendor,
      config.cpu,
      config.cpu_count,
      config.is_highio,
      config.ram,
      config.ram_size,
      config.is_ecc,
      config.hdd_arr,
      config.nvme_count,
      config.nvme_drives,
      config.nvme_size,
      config.sata_count,
      config.sata_drives,
      config.sata_size,
      config.hdd_count,
      config.hdd_drives,
      config.hdd_size,
      config.with_inic,
      config.with_hwr,
      config.with_gpu,
      config.with_rps,
      config.traffic,
      config.bandwidth,
      config.price,
      config.fixed_price,
      config.seen
    ];
    
    auctionBatch.push(auctionStmt.bind(...boundData));
  }
  
  return auctionBatch;
}

/**
 * Finds alerts that match the current server data
 */
export async function findMatchingAlerts(db: DB): Promise<any[]> {
  const matchStmt = db.prepare(MATCH_ALERTS_SQL);
  const result = await matchStmt.all();
  return result.results;
}

/**
 * Groups matched alerts by alert ID
 */
export function groupAlertsByAlertId(matchedAlerts: any[]): Map<number, {
  alertInfo: any;
  matchedAuctions: { auction_id: number; price: number }[];
}> {
  const alertMap = new Map();
  
  for (const match of matchedAlerts) {
    if (!alertMap.has(match.alert_id)) {
      alertMap.set(match.alert_id, {
        alertInfo: {
          id: match.alert_id,
          name: match.name,
          filter: match.filter,
          price: match.price,
          vat_rate: match.vat_rate,
          user_id: match.user_id,
          includes_ipv4_cost: match.includes_ipv4_cost,
          email: match.email,
          created_at: match.created_at
        },
        matchedAuctions: []
      });
    }
    
    // Add this auction to the alert's matched auctions
    alertMap.get(match.alert_id).matchedAuctions.push({
      auction_id: match.auction_id,
      price: match.auction_price
    });
  }
  
  return alertMap;
}

/**
 * Sends notification email for a matched alert
 */
export async function sendAlertNotification(platform: any, alertInfo: any, triggerPrice: number): Promise<void> {
  await sendMail(platform?.env, {
    from: {
      name: "Server Radar",
      email: "no-reply@radar.iodev.org",
    },
    to: alertInfo.email,
    subject: `Price Alert: Target Price Reached`,
    text: `Hi there,

good news! The target price for one of your alerts has been reached.

         Filter: ${alertInfo.name}
   Target Price: ${alertInfo.price.toFixed(2)} EUR (incl. ${alertInfo.vat_rate}% VAT)
  Trigger Price: ${triggerPrice.toFixed(2)} EUR (incl. ${alertInfo.vat_rate}% VAT${alertInfo.includes_ipv4_cost ? ' and IPv4 cost' : ''})


View the matched auctions directly:

  https://radar.iodev.org/alerts?view=${alertInfo.id}

Please note that Server Radar may notice prices with a delay of up to 60
minutes and the server you are looking for may not be available anymore.

Fingers crossed!

Cheers,
Server Radar
--
https://radar.iodev.org/
    `,
  });
}

/**
 * Processes a matched alert by:
 * 1. Sending notification email
 * 2. Inserting alert history record
 * 3. Storing matched auctions
 * 4. Deleting the processed alert
 */
export async function processAlert(
  db: DB, 
  platform: any, 
  alertInfo: any, 
  matchedAuctions: { auction_id: number; price: number }[]
): Promise<void> {
  try {
    // Find the lowest price among matched auctions
    const lowestAuctionPrice = Math.min(...matchedAuctions.map(auction => auction.price));
    
    // Calculate trigger price including VAT and IPv4 cost if applicable
    const ipv4Cost = alertInfo.includes_ipv4_cost ? HETZNER_IPV4_COST_CENTS / 100 : 0;
    const triggerPrice = (lowestAuctionPrice + ipv4Cost) * (1 + alertInfo.vat_rate / 100.0);
    
    // Send notification email
    await sendAlertNotification(platform, alertInfo, triggerPrice);
    
    // Start a transaction for database operations
    const statements: PreparedStatement[] = [];
    
    // Insert alert history record
    const historyStmt = db.prepare(ALERT_HISTORY_INSERT_SQL);
    statements.push(historyStmt.bind(
      alertInfo.id,
      alertInfo.name,
      alertInfo.filter,
      alertInfo.price,
      alertInfo.vat_rate,
      triggerPrice,
      alertInfo.user_id,
      alertInfo.created_at
    ));
    
    // Delete the processed alert
    const deleteStmt = db.prepare(ALERT_DELETE_SQL);
    statements.push(deleteStmt.bind(alertInfo.id));
    
    // Execute all statements in a batch to get the alert history ID
    const results = await db.batch(statements);
    
    // Get the ID of the newly inserted alert history record
    const alertHistoryId = alertInfo.id; // Same as the original alert ID
    
    // Store matched auctions in a separate batch
    const auctionMatchStatements: PreparedStatement[] = [];
    const matchesStmt = db.prepare(ALERT_AUCTION_MATCHES_INSERT_SQL);
    
    for (const auction of matchedAuctions) {
      auctionMatchStatements.push(matchesStmt.bind(
        alertHistoryId,
        auction.auction_id,
        auction.price
      ));
    }
    
    // Execute the auction match statements
    if (auctionMatchStatements.length > 0) {
      await db.batch(auctionMatchStatements);
    }
  } catch (error) {
    console.error(`Error processing alert ${alertInfo.id}:`, error);
    throw error;
  }
}