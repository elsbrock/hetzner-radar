import { dev } from "$app/environment";
import { env } from "$env/dynamic/private";
import type { ServerConfiguration } from "$lib/api/frontend/filter";
import { sendMail } from "$lib/mail";
import type { RequestHandler } from "@sveltejs/kit";

export const POST: RequestHandler = async (event) => {
  const request = event.request;

  // verify api key is present
  const authKey = request.headers.get("x-auth-key");
  if (!dev && (!authKey || authKey !== env.API_KEY)) {
    return new Response(null, {
      status: 401,
      statusText: "Unauthorized",
    });
  }

  // verify it's JSON
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return new Response(null, {
      status: 400,
      statusText: "Bad Request",
    });
  }

  const configs = await request.json() as ServerConfiguration[];

  const db = event.platform?.env.DB;
  if (!db) {
    return new Response(null, {
      status: 500,
      statusText: "Internal Server Error",
    });
  }

  const columns = [
    'id', 'information', 'datacenter', 'location', 'cpu_vendor', 'cpu', 'cpu_count', 'is_highio',
    'ram', 'ram_size', 'is_ecc', 'hdd_arr', 'nvme_count', 'nvme_drives', 'nvme_size',
    'sata_count', 'sata_drives', 'sata_size', 'hdd_count', 'hdd_drives', 'hdd_size',
    'with_inic', 'with_hwr', 'with_gpu', 'with_rps', 'traffic', 'bandwidth', 'price',
    'fixed_price', 'seen'
  ];

  // Prepare the SQL statement with dynamic placeholders
  const placeholders = `(${columns.map(() => '?').join(', ')})`;
  const sql = `
    INSERT INTO temp_servers_staging (${columns.join(', ')})
    VALUES ${placeholders}
  `;

  // Prepare the statement
  const stmt = await db.prepare(sql);

  // split config into batches of 100 and do batch insert
  const batch: PreparedStatement[] = [];
  for (let i = 0; i < configs.length; i++) {
    const config = configs[i];
    batch.push(stmt.bind(
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
        config.seen,
    ));
  }

  const matchStmt = await db.prepare(`
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
            temp_servers_staging c
    )

    SELECT DISTINCT
        pa.id,
        pa.name,
        pa.price,
        pa.user_id,
        user.email,
        pa.created_at,
        min(c.price) as trigger_price
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
        pa.price >= c.price

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
      GROUP BY
        pa.id,
        pa.name,
        pa.price,
        pa.user_id,
        user.email,
        pa.created_at
  `);

  const rollbackStmt = await db.prepare(`delete from temp_servers_staging`);
  const results = await db.batch([...batch, matchStmt, rollbackStmt]);

  const triggeredStmt = await db.prepare(`
    insert into price_alert_history (id, name, filter, price, trigger_price, user_id, created_at, triggered_at)
    select id, name, filter, price, ?, user_id, created_at, current_timestamp from price_alert
    where id = ?
  `);
  const deleteStmt = await db.prepare(`delete from price_alert where id = ?`);

  // send notification mails
  const alertResults = results[results.length-2].results;
  for (const alert of alertResults) {
    const mail = await sendMail(event.platform?.env, {
      from: {
          name: "Server Radar",
          email: "no-reply@radar.iodev.org",
      },
      to: alert.email,
      subject: `Price Alert: Target Price Reached`,
      text: `Hi there,

good news! The target price for one of your alerts has been reached.

         Filter: ${alert.name}
   Target Price: ${alert.price} EUR
  Trigger Price: ${alert.trigger_price} EUR

Visit your alerts section to see further details:

  https://radar.iodev.org/alerts

Please note that Server Radar may notice prices with a delay of up to 60
minutes and the server you are looking for may not be available anymore.

Fingers crossed!

Cheers,
Server Radar
      `,
    });
    await db.batch([triggeredStmt.bind(alert.trigger_price, alert.id), deleteStmt.bind(alert.id)]);
  }

	return new Response(JSON.stringify(results[results.length-2]));
}
