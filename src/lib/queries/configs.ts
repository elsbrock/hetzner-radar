import type { AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";
import SQL from "sql-template-strings";
import { getData } from "$lib/dbapi";
import { type ServerConfiguration } from "$lib/queries/filter";

export async function getCheapestConfigurations(conn: AsyncDuckDBConnection): Promise<ServerConfiguration[]> {
	return (await getData<ServerConfiguration>(conn, SQL`
		SELECT DISTINCT ON (cpu)
			* exclude(id, nvme_drives, sata_drives, hdd_drives, seen),
			nvme_drives::JSON as nvme_drives,
			sata_drives::JSON as sata_drives,
			hdd_drives::JSON as hdd_drives,
			extract('epoch' from seen) as last_seen
		FROM server
		WHERE date_trunc('day', seen) = (
				SELECT MAX(date_trunc('day', seen)) 
				FROM server
			)
			AND ram_size > 0 AND (hdd_size > 0 OR nvme_size > 0 OR sata_size > 0)
		ORDER BY price ASC
		LIMIT 4
	`)).map((d: ServerConfiguration) => {
		d.nvme_drives = JSON.parse(d.nvme_drives as unknown as string);
		d.sata_drives = JSON.parse(d.sata_drives as unknown as string);
		d.hdd_drives = JSON.parse(d.hdd_drives as unknown as string);
		return d;
	});
}

export async function getCheapestDiskConfigurations(conn: AsyncDuckDBConnection): Promise<ServerConfiguration[]> {
	return (await getData<ServerConfiguration>(conn, SQL`
		SELECT DISTINCT ON (cpu)
			* exclude(id, nvme_drives, sata_drives, hdd_drives, seen),
			nvme_drives::JSON as nvme_drives,
			sata_drives::JSON as sata_drives,
			hdd_drives::JSON as hdd_drives,
			extract('epoch' from seen) as last_seen
		FROM server
		WHERE date_trunc('day', seen) = (
				SELECT MAX(date_trunc('day', seen)) 
				FROM server
			)
			AND ram_size > 0 AND (hdd_size > 0 OR nvme_size > 0 OR sata_size > 0)
		ORDER BY (price / hdd_size) ASC
		LIMIT 4
	`)).map((d: ServerConfiguration) => {
		d.nvme_drives = JSON.parse(d.nvme_drives as unknown as string);
		d.sata_drives = JSON.parse(d.sata_drives as unknown as string);
		d.hdd_drives = JSON.parse(d.hdd_drives as unknown as string);
		return d;
	});
}

export async function getCheapestRamConfigurations(conn: AsyncDuckDBConnection): Promise<ServerConfiguration[]> {
	return (await getData<ServerConfiguration>(conn, SQL`
		SELECT DISTINCT ON (cpu)
			* exclude(id, nvme_drives, sata_drives, hdd_drives, seen),
			nvme_drives::JSON as nvme_drives,
			sata_drives::JSON as sata_drives,
			hdd_drives::JSON as hdd_drives,
			extract('epoch' from seen) as last_seen
		FROM server
		WHERE date_trunc('day', seen) = (
				SELECT MAX(date_trunc('day', seen)) 
				FROM server
			)
			AND ram_size > 0 AND (hdd_size > 0 OR nvme_size > 0 OR sata_size > 0)
		ORDER BY (price / ram_size) ASC
		LIMIT 4
	`)).map((d: ServerConfiguration) => {
		d.nvme_drives = JSON.parse(d.nvme_drives as unknown as string);
		d.sata_drives = JSON.parse(d.sata_drives as unknown as string);
		d.hdd_drives = JSON.parse(d.hdd_drives as unknown as string);
		return d;
	});
}