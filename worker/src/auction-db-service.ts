/**
 * Auction Database Service
 *
 * Handles database operations for auction data
 * Based on the logic from src/lib/api/backend/alerts-push.ts
 */

import type { RawServerData } from './auction-data-transformer';

export interface DatabaseStats {
	processed: number;
	newAuctions: number;
	priceChanges: number;
	errors: number;
}

export class AuctionDatabaseService {
	private db: D1Database;

	constructor(db: D1Database) {
		this.db = db;
	}

	/**
	 * Processes and stores auction data with dual table architecture
	 * - Only inserts into auctions table if price has changed (deduplication)
	 * - Always updates current_auctions table with latest state
	 */
	async storeAuctionData(configs: RawServerData[]): Promise<DatabaseStats> {
		console.log(`[AuctionDatabaseService] Processing ${configs.length} auction records`);

		const stats: DatabaseStats = {
			processed: 0,
			newAuctions: 0,
			priceChanges: 0,
			errors: 0,
		};

		if (configs.length === 0) {
			return stats;
		}

		try {
			// Get current prices and last_changed timestamps
			const currentStates = await this.getCurrentAuctionStates(configs);

			// Update latest batch time
			await this.updateLatestBatch();

			// Prepare statements for batch processing
			const statements = await this.prepareStatements(configs, currentStates, stats);

			// Execute all statements in batch
			console.log(`[AuctionDatabaseService] Executing ${statements.length} database statements`);
			await this.db.batch(statements);

			stats.processed = configs.length;
			console.log(`[AuctionDatabaseService] Successfully processed ${stats.processed} records`, stats);

			return stats;
		} catch (error) {
			console.error('[AuctionDatabaseService] Failed to store auction data:', error);
			stats.errors = configs.length;
			throw error;
		}
	}

	/**
	 * Gets current states of auctions from current_auctions table
	 */
	private async getCurrentAuctionStates(configs: RawServerData[]): Promise<Map<number, { price: number; last_changed: string }>> {
		const currentStates = new Map<number, { price: number; last_changed: string }>();
		const chunkSize = 100; // SQLite has a default limit of 999 variables

		for (let i = 0; i < configs.length; i += chunkSize) {
			const chunk = configs.slice(i, i + chunkSize);
			if (chunk.length === 0) continue;

			const query = `
				SELECT id, price, last_changed
				FROM current_auctions
				WHERE id IN (${chunk.map(() => '?').join(',')})
			`;

			const stmt = this.db.prepare(query);
			const results = await stmt.bind(...chunk.map((c) => c.id)).all();

			for (const row of results.results) {
				currentStates.set(row.id as number, {
					price: row.price as number,
					last_changed: row.last_changed as string,
				});
			}
		}

		console.log(`[AuctionDatabaseService] Found ${currentStates.size} existing auction states`);
		return currentStates;
	}

	/**
	 * Updates the latest batch timestamp
	 */
	private async updateLatestBatch(): Promise<void> {
		const batchTime = new Date().toISOString();
		const stmt = this.db.prepare(`
			UPDATE latest_batch SET batch_time = ?, updated_at = datetime('now') WHERE id = 1
		`);
		await stmt.bind(batchTime).run();
	}

	/**
	 * Prepares database statements for batch execution
	 */
	private async prepareStatements(
		configs: RawServerData[],
		currentStates: Map<number, { price: number; last_changed: string }>,
		stats: DatabaseStats,
	): Promise<D1PreparedStatement[]> {
		const statements: D1PreparedStatement[] = [];

		// Prepare statements
		const auctionInsertSql = `
			INSERT OR IGNORE INTO auctions (
				id, information, datacenter, location, cpu_vendor, cpu, cpu_count, is_highio,
				ram, ram_size, is_ecc, hdd_arr, nvme_count, nvme_drives, nvme_size,
				sata_count, sata_drives, sata_size, hdd_count, hdd_drives, hdd_size,
				with_inic, with_hwr, with_gpu, with_rps, traffic, bandwidth, price,
				fixed_price, seen
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`;

		const currentAuctionUpsertSql = `
			INSERT OR REPLACE INTO current_auctions (
				id, information, datacenter, location, cpu_vendor, cpu, cpu_count, is_highio,
				ram, ram_size, is_ecc, hdd_arr, nvme_count, nvme_drives, nvme_size,
				sata_count, sata_drives, sata_size, hdd_count, hdd_drives, hdd_size,
				with_inic, with_hwr, with_gpu, with_rps, traffic, bandwidth, price,
				fixed_price, seen, last_changed, created_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
					COALESCE((SELECT created_at FROM current_auctions WHERE id = ?), datetime('now')))
		`;

		for (const config of configs) {
			const currentState = currentStates.get(config.id);

			// Check if this is a new auction or if price has changed
			const isNew = currentState === undefined;
			const priceChanged = currentState !== undefined && currentState.price !== config.price;

			if (isNew) stats.newAuctions++;
			if (priceChanged) stats.priceChanges++;

			// Only insert into auctions table if new or price changed
			if (isNew || priceChanged) {
				const auctionStmt = this.db.prepare(auctionInsertSql);
				statements.push(
					auctionStmt.bind(
						config.id,
						config.information,
						config.datacenter,
						config.location,
						config.cpu_vendor,
						config.cpu,
						config.cpu_count,
						config.is_highio,
						config.ram,
						config.ram_size ?? 0,
						config.is_ecc,
						config.hdd_arr,
						config.nvme_count ?? 0,
						config.nvme_drives,
						config.nvme_size ?? 0,
						config.sata_count ?? 0,
						config.sata_drives,
						config.sata_size ?? 0,
						config.hdd_count ?? 0,
						config.hdd_drives,
						config.hdd_size ?? 0,
						config.with_inic,
						config.with_hwr,
						config.with_gpu,
						config.with_rps,
						config.traffic,
						config.bandwidth ?? 0,
						config.price,
						config.fixed_price,
						config.seen,
					),
				);
			}

			// Determine last_changed timestamp
			const lastChanged = isNew || priceChanged ? config.seen : currentState?.last_changed || config.seen;

			// Always update current_auctions
			const currentStmt = this.db.prepare(currentAuctionUpsertSql);
			statements.push(
				currentStmt.bind(
					config.id,
					config.information,
					config.datacenter,
					config.location,
					config.cpu_vendor,
					config.cpu,
					config.cpu_count,
					config.is_highio,
					config.ram,
					config.ram_size ?? 0,
					config.is_ecc,
					config.hdd_arr,
					config.nvme_count ?? 0,
					config.nvme_drives,
					config.nvme_size ?? 0,
					config.sata_count ?? 0,
					config.sata_drives,
					config.sata_size ?? 0,
					config.hdd_count ?? 0,
					config.hdd_drives,
					config.hdd_size ?? 0,
					config.with_inic,
					config.with_hwr,
					config.with_gpu,
					config.with_rps,
					config.traffic,
					config.bandwidth ?? 0,
					config.price,
					config.fixed_price,
					config.seen,
					lastChanged,
					config.id, // for the WHERE clause in created_at subquery
				),
			);
		}

		console.log(
			`[AuctionDatabaseService] Prepared ${statements.length} statements: ${stats.newAuctions} new, ${stats.priceChanges} price changes`,
		);
		return statements;
	}
}
