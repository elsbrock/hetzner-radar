/**
 * Auction Service
 *
 * Handles Hetzner auction data import
 */

import { HetznerAuctionClient } from './hetzner-auction-client';
import { AuctionDataTransformer } from './auction-data-transformer';
import { AuctionDatabaseService } from './auction-db-service';
import { buildSnapshot, SNAPSHOT_KEY } from './auction-snapshot';

interface AuctionImportResult {
	fetched: number;
	transformed: number;
	valid: number;
	invalid: number;
	processed: number;
	newAuctions: number;
	priceChanges: number;
	errors: number;
	timestamp: string;
}

export class AuctionService {
	private auctionApiUrl: string;
	private db: D1Database;
	private storage: DurableObjectStorage;
	private doId: string;
	private snapshotKv?: KVNamespace;

	constructor(auctionApiUrl: string, db: D1Database, storage: DurableObjectStorage, doId: string, snapshotKv?: KVNamespace) {
		this.auctionApiUrl = auctionApiUrl;
		this.db = db;
		this.storage = storage;
		this.doId = doId;
		this.snapshotKv = snapshotKv;
	}

	/**
	 * Publishes the auction snapshot consumed by the public MCP server.
	 *
	 * Deliberately non-fatal: the snapshot is a read-optimisation for /mcp, so a
	 * KV failure must never fail an import that already committed to D1 (which
	 * is what alerting depends on). A stale snapshot degrades MCP freshness by
	 * one cycle; a thrown error would cost an alert run.
	 */
	private async publishSnapshot(
		transformed: Awaited<ReturnType<typeof AuctionDataTransformer.transformServers>>,
		rawServers: Parameters<typeof buildSnapshot>[1],
		generatedAt: string,
	): Promise<void> {
		if (!this.snapshotKv) {
			console.warn(`[AuctionService ${this.doId}] SNAPSHOT KV not bound; skipping snapshot write`);
			return;
		}

		try {
			const snapshot = buildSnapshot(transformed, rawServers, generatedAt);
			const body = JSON.stringify(snapshot);
			await this.snapshotKv.put(SNAPSHOT_KEY, body);
			console.log(`[AuctionService ${this.doId}] Published snapshot: ${snapshot.count} auctions, ${body.length} bytes`);
		} catch (error) {
			console.error(`[AuctionService ${this.doId}] Failed to publish snapshot:`, error);
		}
	}

	async fetchAndImportAuctions(): Promise<AuctionImportResult> {
		console.log(`[AuctionService ${this.doId}] fetchAndImportAuctions called at ${new Date().toISOString()}`);

		if (!this.db) {
			console.error(`[AuctionService ${this.doId}] D1 database is not configured.`);
			throw new Error('D1 database is not configured.');
		}

		const startTime = Date.now();

		try {
			// Create auction client and database service
			const auctionClient = new HetznerAuctionClient(this.auctionApiUrl);
			const dbService = new AuctionDatabaseService(this.db);

			console.log(`[AuctionService ${this.doId}] Fetching auction data from: ${this.auctionApiUrl}`);

			// Fetch raw auction data
			const rawServers = await auctionClient.fetchAuctionData();
			console.log(`[AuctionService ${this.doId}] Fetched ${rawServers.length} auction records`);

			// Transform the data
			const transformedServers = AuctionDataTransformer.transformServers(rawServers);
			console.log(`[AuctionService ${this.doId}] Transformed ${transformedServers.length} auction records`);

			// Validate transformed data
			const { valid, invalid } = AuctionDataTransformer.validateTransformedData(transformedServers);
			if (invalid > 0) {
				console.warn(`[AuctionService ${this.doId}] ${invalid} invalid records filtered out`);
			}

			if (valid.length === 0) {
				console.warn(`[AuctionService ${this.doId}] No valid auction data to import`);
				return { processed: 0, newAuctions: 0, priceChanges: 0, errors: 0 };
			}

			// Store in database
			console.log(`[AuctionService ${this.doId}] Storing ${valid.length} auction records in database`);
			const stats = await dbService.storeAuctionData(valid);

			// Update last import timestamp
			const importTimestamp = new Date().toISOString();
			await this.storage.put('lastAuctionImport', importTimestamp);

			// Publish the MCP snapshot from the data already in memory.
			await this.publishSnapshot(valid, rawServers, importTimestamp);

			const duration = Date.now() - startTime;
			console.log(`[AuctionService ${this.doId}] Auction import completed successfully in ${duration}ms:`, {
				fetched: rawServers.length,
				transformed: transformedServers.length,
				valid: valid.length,
				invalid,
				...stats,
				timestamp: importTimestamp,
			});

			return { ...stats, duration, fetched: rawServers.length, transformed: transformedServers.length, valid: valid.length, invalid };
		} catch (error) {
			const duration = Date.now() - startTime;
			console.error(`[AuctionService ${this.doId}] Auction import failed after ${duration}ms:`, error);
			throw { error, duration };
		}
	}
}
