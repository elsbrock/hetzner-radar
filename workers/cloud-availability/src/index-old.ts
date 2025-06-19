import { WorkerEntrypoint, DurableObject } from 'cloudflare:workers';
import { HetznerAuctionClient } from './hetzner-auction-client';
import { AuctionDataTransformer } from './auction-data-transformer';
import { AuctionDatabaseService } from './auction-db-service';

/**
 * Cloud Availability Worker
 *
 * This worker handles two main functions:
 * 1. Fetches Hetzner Cloud server availability data every 60 seconds
 * 2. Imports Hetzner dedicated server auction data every 5 minutes
 *
 * Required secrets (set via wrangler secret put):
 * - HETZNER_API_TOKEN: Token for accessing Hetzner Cloud API
 * - API_KEY: Authentication key for notifying the main app
 *
 * Environment variables (set in wrangler.jsonc):
 * - MAIN_APP_URL: URL of the main application (e.g., https://radar.iodev.org)
 * - FETCH_INTERVAL_MS: How often to check Hetzner Cloud API (default: 60000ms)
 * - AUCTION_IMPORT_INTERVAL_MS: How often to import auction data (default: 300000ms)
 * - HETZNER_AUCTION_API_URL: URL for Hetzner auction API (default: Hetzner's live data endpoint)
 *
 * Database bindings:
 * - DB: D1 database for storing auction data (auctions and current_auctions tables)
 */

interface Env {
	CLOUD_STATUS_DO: DurableObjectNamespace<CloudAvailability>;
	HETZNER_API_TOKEN: string;
	FETCH_INTERVAL_MS?: string;
	ANALYTICS_ENGINE: AnalyticsEngineDataset;
	MAIN_APP_URL?: string;
	API_KEY?: string;
	DB: D1Database;
	AUCTION_IMPORT_INTERVAL_MS?: string;
	HETZNER_AUCTION_API_URL?: string;
}

interface HetznerServerType {
	id: number;
	name: string;
	description: string;
	cores: number;
	memory: number;
	disk: number;
	storage_type: 'local' | 'network';
	cpu_type: 'shared' | 'dedicated';
	architecture: string;
	deprecation: {
		unavailable_after: string;
		announced: string;
	} | null;
}

interface HetznerLocation {
	id: number;
	name: string;
	description: string;
	network_zone: string;
	city: string;
	country: string;
	latitude: number;
	longitude: number;
}

interface HetznerDatacenter {
	id: number;
	name: string; // e.g., "fsn1-dc14"
	description: string;
	location: HetznerLocation;
	server_types: {
		supported: number[];
		available: number[];
		available_for_migration: number[];
	};
}

interface LocationInfo {
	id: number;
	name: string;
	city: string;
	country: string;
	latitude: number;
	longitude: number;
}

interface ServerTypeInfo {
	id: number;
	name: string;
	description: string;
	cores: number;
	memory: number;
	disk: number;
	cpu_type: 'shared' | 'dedicated';
	architecture: string;
	isDeprecated: boolean;
}

type AvailabilityMatrix = Record<number, number[]>;
type SupportMatrix = Record<number, number[]>;
type LastSeenMatrix = Record<string, string>; // key: "locationId-serverTypeId", value: ISO timestamp

interface CloudStatusData {
	serverTypes: ServerTypeInfo[];
	locations: LocationInfo[];
	availability: AvailabilityMatrix;
	supported: SupportMatrix;
	lastUpdated: string | null;
	lastSeenAvailable?: LastSeenMatrix;
}

interface AvailabilityChange {
	serverTypeId: number;
	serverTypeName: string;
	locationId: number;
	locationName: string;
	eventType: 'available' | 'unavailable';
	timestamp: number;
}

const HETZNER_API_BASE = 'https://api.hetzner.cloud/v1';
const DEFAULT_FETCH_INTERVAL_MS = 60 * 1000;
const DEFAULT_AUCTION_IMPORT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_HETZNER_AUCTION_API_URL = 'https://www.hetzner.com/_resources/app/data/app/live_data_sb_EUR.json';

export class CloudAvailability extends DurableObject {
	ctx: DurableObjectState;
	env: Env;
	fetchIntervalMs: number;
	auctionImportIntervalMs: number;
	hetznerAuctionApiUrl: string;
	initializing: boolean = false;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);

		this.ctx = ctx;
		this.env = env;
		this.fetchIntervalMs = env.FETCH_INTERVAL_MS ? parseInt(env.FETCH_INTERVAL_MS) : DEFAULT_FETCH_INTERVAL_MS;
		this.auctionImportIntervalMs = env.AUCTION_IMPORT_INTERVAL_MS ? parseInt(env.AUCTION_IMPORT_INTERVAL_MS) : DEFAULT_AUCTION_IMPORT_INTERVAL_MS;
		this.hetznerAuctionApiUrl = env.HETZNER_AUCTION_API_URL || DEFAULT_HETZNER_AUCTION_API_URL;

		// Log environment variable presence
		console.log(`[CloudAvailability DO ${this.ctx.id}] Environment variables check:`);
		console.log(`  - HETZNER_API_TOKEN: ${env.HETZNER_API_TOKEN ? 'Present' : 'MISSING'}`);
		console.log(`  - MAIN_APP_URL: ${env.MAIN_APP_URL ? `Present (${env.MAIN_APP_URL})` : 'MISSING'}`);
		console.log(`  - API_KEY: ${env.API_KEY ? 'Present' : 'MISSING'}`);
		console.log(`  - ANALYTICS_ENGINE: ${env.ANALYTICS_ENGINE ? 'Present' : 'MISSING'}`);
		console.log(`  - DB: ${env.DB ? 'Present' : 'MISSING'}`);
		console.log(`  - FETCH_INTERVAL_MS: ${this.fetchIntervalMs}ms`);
		console.log(`  - AUCTION_IMPORT_INTERVAL_MS: ${this.auctionImportIntervalMs}ms`);
		console.log(`  - HETZNER_AUCTION_API_URL: ${this.hetznerAuctionApiUrl}`);
	}

	async ensureInitialized(): Promise<void> {
		if (this.initializing) {
			console.log(
				`[CloudAvailability DO ${this.ctx.id}] Already initializing=${this.initializing}, skipping...`,
			);
			return;
		}
		this.initializing = true;

		try {
			const currentAlarm = await this.ctx.storage.getAlarm();
			console.log(`[CloudAvailability DO ${this.ctx.id}] Current alarm: ${currentAlarm ? new Date(currentAlarm).toISOString() : 'none'}`);

			if (currentAlarm === null) {
				console.log(`[CloudAvailability DO ${this.ctx.id}] No alarm set, setting initial alarm.`);
				await this.ctx.storage.setAlarm(Date.now() + 5000);
			}

			const lastUpdated: string | undefined = await this.ctx.storage.get('lastUpdated');
			const lastAuctionImport: string | undefined = await this.ctx.storage.get('lastAuctionImport');
			console.log(`[CloudAvailability DO ${this.ctx.id}] Last cloud status updated: ${lastUpdated || 'never'}`);
			console.log(`[CloudAvailability DO ${this.ctx.id}] Last auction import: ${lastAuctionImport || 'never'}`);

			if (!lastUpdated) {
				console.log(`[CloudAvailability DO ${this.ctx.id}] No initial cloud status data found, fetching immediately.`);
				this.fetchAndUpdateStatus().catch((err) => console.error(`[CloudAvailability DO ${this.ctx.id}] Initial cloud status fetch failed:`, err));
			} else {
				console.log(`[CloudAvailability DO ${this.ctx.id}] Initial cloud status data exists.`);
			}

			if (!lastAuctionImport) {
				console.log(`[CloudAvailability DO ${this.ctx.id}] No initial auction data found, fetching immediately.`);
				this.fetchAndImportAuctions().catch((err) => console.error(`[CloudAvailability DO ${this.ctx.id}] Initial auction import failed:`, err));
			} else {
				console.log(`[CloudAvailability DO ${this.ctx.id}] Initial auction data exists.`);
			}
		} catch (err) {
			console.error(`[CloudAvailability DO ${this.ctx.id}] Initialization check failed:`, err);
		} finally {
			this.initializing = false;
		}
	}

	async alarm(): Promise<void> {
		console.log(`[CloudAvailability DO ${this.ctx.id}] Alarm triggered, determining what to fetch...`);

		const now = Date.now();
		const lastCloudUpdate = await this.ctx.storage.get<string>('lastUpdated');
		const lastAuctionImport = await this.ctx.storage.get<string>('lastAuctionImport');

		// Determine what needs to be updated based on time intervals
		const cloudUpdateDue = !lastCloudUpdate || (now - new Date(lastCloudUpdate).getTime()) >= this.fetchIntervalMs;
		const auctionImportDue = !lastAuctionImport || (now - new Date(lastAuctionImport).getTime()) >= this.auctionImportIntervalMs;

		console.log(`[CloudAvailability DO ${this.ctx.id}] Tasks due: Cloud=${cloudUpdateDue}, Auctions=${auctionImportDue}`);

		// Execute tasks in parallel if both are due
		const tasks: Promise<void>[] = [];

		if (cloudUpdateDue) {
			tasks.push(this.fetchAndUpdateStatus().catch(error => {
				console.error(`[CloudAvailability DO ${this.ctx.id}] Failed to update cloud status:`, error);
			}));
		}

		if (auctionImportDue) {
			tasks.push(this.fetchAndImportAuctions().catch(error => {
				console.error(`[CloudAvailability DO ${this.ctx.id}] Failed to import auctions:`, error);
			}));
		}

		if (tasks.length > 0) {
			await Promise.all(tasks);
		}

		// Schedule next alarm for the sooner of the two intervals
		const nextCloudUpdate = lastCloudUpdate ? new Date(lastCloudUpdate).getTime() + this.fetchIntervalMs : now + this.fetchIntervalMs;
		const nextAuctionImport = lastAuctionImport ? new Date(lastAuctionImport).getTime() + this.auctionImportIntervalMs : now + this.auctionImportIntervalMs;
		const nextAlarmTime = Math.min(nextCloudUpdate, nextAuctionImport);

		await this.ctx.storage.setAlarm(nextAlarmTime);
		console.log(`[CloudAvailability DO ${this.ctx.id}] Next alarm scheduled for: ${new Date(nextAlarmTime).toISOString()}`);
	}

	async fetch(request: Request): Promise<Response> {
		await this.ensureInitialized();

		const url = new URL(request.url);

		if (url.pathname === '/status' && request.method === 'GET') {
			try {
				const status = await this.getStatus();
				return new Response(JSON.stringify(status), {
					headers: { 'Content-Type': 'application/json' },
				});
			} catch (error) {
				console.error(`[CloudAvailability DO ${this.ctx.id}] Error serving /status:`, error);
				return new Response('Error fetching status', { status: 500 });
			}
		}

		if (url.pathname === '/import-auctions' && request.method === 'POST') {
			try {
				console.log(`[CloudAvailability DO ${this.ctx.id}] Manual auction import triggered`);
				const startTime = Date.now();
				await this.fetchAndImportAuctions();
				const duration = Date.now() - startTime;

				return new Response(JSON.stringify({
					success: true,
					message: 'Auction import completed successfully',
					duration: `${duration}ms`
				}), {
					headers: { 'Content-Type': 'application/json' },
				});
			} catch (error) {
				console.error(`[CloudAvailability DO ${this.ctx.id}] Manual auction import failed:`, error);
				return new Response(JSON.stringify({
					success: false,
					error: error instanceof Error ? error.message : String(error)
				}), {
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				});
			}
		}

		if (url.pathname === '/debug' && request.method === 'GET') {
			try {
				const lastCloudUpdate = await this.ctx.storage.get<string>('lastUpdated');
				const lastAuctionImport = await this.ctx.storage.get<string>('lastAuctionImport');
				const currentAlarm = await this.ctx.storage.getAlarm();

				return new Response(JSON.stringify({
					lastCloudUpdate: lastCloudUpdate || 'never',
					lastAuctionImport: lastAuctionImport || 'never',
					nextAlarm: currentAlarm ? new Date(currentAlarm).toISOString() : 'none',
					intervals: {
						cloudStatus: `${this.fetchIntervalMs}ms`,
						auctionImport: `${this.auctionImportIntervalMs}ms`
					},
					auctionApiUrl: this.hetznerAuctionApiUrl
				}), {
					headers: { 'Content-Type': 'application/json' },
				});
			} catch (error) {
				return new Response('Error fetching debug info', { status: 500 });
			}
		}

		return new Response('Available endpoints:\n- GET /status (cloud availability)\n- POST /import-auctions (trigger manual import)\n- GET /debug (debug info)', { status: 404 });
	}

	async getStatus(): Promise<CloudStatusData> {
		await this.ensureInitialized();

		const [serverTypes, locations, availability, supported, lastUpdated, lastSeenAvailable] = await Promise.all([
			this.ctx.storage.get<ServerTypeInfo[]>('serverTypes'),
			this.ctx.storage.get<LocationInfo[]>('locations'),
			this.ctx.storage.get<AvailabilityMatrix>('availability'),
			this.ctx.storage.get<SupportMatrix>('supported'),
			this.ctx.storage.get<string>('lastUpdated'),
			this.ctx.storage.get<LastSeenMatrix>('lastSeenAvailable'),
		]);

		return {
			serverTypes: serverTypes || [],
			locations: locations || [],
			availability: availability || {},
			supported: supported || {},
			lastUpdated: lastUpdated || null,
			lastSeenAvailable: lastSeenAvailable || {},
		};
	}

	async fetchAndUpdateStatus(): Promise<void> {
		console.log(`[CloudAvailability DO ${this.ctx.id}] fetchAndUpdateStatus called at ${new Date().toISOString()}`);

		const apiToken = this.env.HETZNER_API_TOKEN;
		if (!apiToken) {
			console.error(`[CloudAvailability DO ${this.ctx.id}] HETZNER_API_TOKEN secret is not configured.`);
			throw new Error('HETZNER_API_TOKEN is not configured.');
		}

		const headers = {
			Authorization: `Bearer ${apiToken}`,
			'User-Agent': 'Hetzner-Radar-CloudAvailability-Monitor (https://github.com/elsbrock/hetzner-radar)',
		};

		try {
			console.log(`[CloudAvailability DO ${this.ctx.id}] Fetching server types...`);
			const serverTypesResponse = await fetch(`${HETZNER_API_BASE}/server_types`, { headers });
			if (!serverTypesResponse.ok) {
				throw new Error(`Failed to fetch server types: ${serverTypesResponse.status} ${await serverTypesResponse.text()}`);
			}
			const serverTypesData = (await serverTypesResponse.json()) as { server_types: HetznerServerType[] };
			console.log(`[CloudAvailability DO ${this.ctx.id}] Fetched ${serverTypesData.server_types.length} server types.`);

			console.log(`[CloudAvailability DO ${this.ctx.id}] Fetching datacenters...`);
			const datacentersResponse = await fetch(`${HETZNER_API_BASE}/datacenters?per_page=50`, { headers });
			if (!datacentersResponse.ok) {
				throw new Error(`Failed to fetch datacenters: ${datacentersResponse.status} ${await datacentersResponse.text()}`);
			}
			const datacentersData = (await datacentersResponse.json()) as { datacenters: HetznerDatacenter[] };
			console.log(`[CloudAvailability DO ${this.ctx.id}] Fetched ${datacentersData.datacenters.length} datacenters.`);

			const processedServerTypes: ServerTypeInfo[] = serverTypesData.server_types.map((st) => ({
				id: st.id,
				name: st.name,
				description: st.description,
				cores: st.cores,
				memory: st.memory,
				disk: st.disk,
				cpu_type: st.cpu_type,
				architecture: st.architecture,
				isDeprecated: st.deprecation !== null,
			}));
			processedServerTypes.sort((a, b) => a.name.localeCompare(b.name));

			const processedLocationsMap = new Map<number, LocationInfo>();
			const processedAvailability: AvailabilityMatrix = {};
			const processedSupported: SupportMatrix = {};

			for (const dc of datacentersData.datacenters) {
				const locId = dc.location.id;

				if (!processedLocationsMap.has(locId)) {
					processedLocationsMap.set(locId, {
						id: locId,
						name: dc.location.name,
						city: dc.location.city,
						country: dc.location.country,
						latitude: dc.location.latitude,
						longitude: dc.location.longitude,
					});
				}

				if (!processedAvailability[locId]) {
					processedAvailability[locId] = [];
				}
				if (!processedSupported[locId]) {
					processedSupported[locId] = [];
				}

				const currentAvailable = new Set(processedAvailability[locId]);
				dc.server_types.available.forEach((serverId) => currentAvailable.add(serverId));
				processedAvailability[locId] = Array.from(currentAvailable).sort((a, b) => a - b);

				const currentSupported = new Set(processedSupported[locId]);
				dc.server_types.supported.forEach((serverId) => currentSupported.add(serverId));
				processedSupported[locId] = Array.from(currentSupported).sort((a, b) => a - b);
			}

			const processedLocations: LocationInfo[] = Array.from(processedLocationsMap.values());
			processedLocations.sort((a, b) => a.name.localeCompare(b.name));

			// Log availability summary
			console.log(`[CloudAvailability DO ${this.ctx.id}] Availability summary:`);
			let totalAvailable = 0;
			for (const [locId, serverTypes] of Object.entries(processedAvailability)) {
				totalAvailable += serverTypes.length;
				console.log(`  - Location ${locId}: ${serverTypes.length} server types available`);
			}
			console.log(`  - Total: ${totalAvailable} server type/location combinations`);

			// Get previous availability for change detection
			const previousAvailability = await this.ctx.storage.get<AvailabilityMatrix>('availability');

			// Update last seen availability timestamps
			const existingLastSeen = await this.ctx.storage.get<LastSeenMatrix>('lastSeenAvailable') || {};
			const updatedLastSeen = { ...existingLastSeen };
			const updateTimestamp = new Date().toISOString();

			console.log(`[CloudAvailability DO ${this.ctx.id}] Updating last seen availability timestamps...`);
			let lastSeenUpdates = 0;

			// For each currently available server type, update its last seen timestamp
			for (const [locationId, availableServerTypes] of Object.entries(processedAvailability)) {
				for (const serverTypeId of availableServerTypes) {
					const key = `${locationId}-${serverTypeId}`;
					updatedLastSeen[key] = updateTimestamp;
					lastSeenUpdates++;
				}
			}

			console.log(`[CloudAvailability DO ${this.ctx.id}] Updated ${lastSeenUpdates} last seen timestamps`);

			console.log(`[CloudAvailability DO ${this.ctx.id}] Storing processed data...`);
			await this.ctx.storage.put({
				serverTypes: processedServerTypes,
				locations: processedLocations,
				availability: processedAvailability,
				supported: processedSupported,
				lastUpdated: updateTimestamp,
				lastSeenAvailable: updatedLastSeen,
			});

			// Detect and handle changes
			console.log(
				`[CloudAvailability DO ${this.ctx.id}] Change detection: previousAvailability=${previousAvailability ? 'exists' : 'null'}`,
			);

			if (previousAvailability) {
				console.log(`[CloudAvailability DO ${this.ctx.id}] Running change detection...`);
				const changes = await this.detectChanges(previousAvailability, processedAvailability, processedServerTypes, processedLocations);

				if (changes.length > 0) {
					console.log(`[CloudAvailability DO ${this.ctx.id}] Detected ${changes.length} availability changes:`);
					changes.forEach((change, idx) => {
						console.log(`  ${idx + 1}. ${change.eventType}: ${change.serverTypeName} in ${change.locationName}`);
					});
					await this.handleAvailabilityChanges(changes);
				} else {
					console.log(`[CloudAvailability DO ${this.ctx.id}] No availability changes detected`);
				}
			} else {
				console.log(`[CloudAvailability DO ${this.ctx.id}] Skipping change detection: no previous availability data`);
			}

			console.log(`[CloudAvailability DO ${this.ctx.id}] Data stored successfully at ${updateTimestamp}.`);
		} catch (error) {
			console.error(`[CloudAvailability DO ${this.ctx.id}] Error during fetch/update:`, error);
			throw error;
		}
	}

	async fetchAndImportAuctions(): Promise<void> {
		console.log(`[CloudAvailability DO ${this.ctx.id}] fetchAndImportAuctions called at ${new Date().toISOString()}`);

		if (!this.env.DB) {
			console.error(`[CloudAvailability DO ${this.ctx.id}] D1 database is not configured.`);
			throw new Error('D1 database is not configured.');
		}

		const startTime = Date.now();

		try {
			// Create auction client and database service
			const auctionClient = new HetznerAuctionClient(this.hetznerAuctionApiUrl);
			const dbService = new AuctionDatabaseService(this.env.DB);

			console.log(`[CloudAvailability DO ${this.ctx.id}] Fetching auction data from: ${this.hetznerAuctionApiUrl}`);

			// Fetch raw auction data
			const rawServers = await auctionClient.fetchAuctionData();
			console.log(`[CloudAvailability DO ${this.ctx.id}] Fetched ${rawServers.length} auction records`);

			// Transform the data
			const transformedServers = AuctionDataTransformer.transformServers(rawServers);
			console.log(`[CloudAvailability DO ${this.ctx.id}] Transformed ${transformedServers.length} auction records`);

			// Validate transformed data
			const { valid, invalid } = AuctionDataTransformer.validateTransformedData(transformedServers);
			if (invalid > 0) {
				console.warn(`[CloudAvailability DO ${this.ctx.id}] ${invalid} invalid records filtered out`);
			}

			if (valid.length === 0) {
				console.warn(`[CloudAvailability DO ${this.ctx.id}] No valid auction data to import`);
				return;
			}

			// Store in database
			console.log(`[CloudAvailability DO ${this.ctx.id}] Storing ${valid.length} auction records in database`);
			const stats = await dbService.storeAuctionData(valid);

			// Update last import timestamp
			const importTimestamp = new Date().toISOString();
			await this.ctx.storage.put('lastAuctionImport', importTimestamp);

			const duration = Date.now() - startTime;
			console.log(`[CloudAvailability DO ${this.ctx.id}] Auction import completed successfully in ${duration}ms:`, {
				fetched: rawServers.length,
				transformed: transformedServers.length,
				valid: valid.length,
				invalid,
				...stats,
				timestamp: importTimestamp,
			});

			// Write to Analytics Engine if available
			if (this.env.ANALYTICS_ENGINE) {
				try {
					this.env.ANALYTICS_ENGINE.writeDataPoint({
						blobs: ['auction_import', 'success'],
						doubles: [stats.processed, stats.newAuctions, stats.priceChanges, duration],
						indexes: ['auction_import_success'],
					});
				} catch (error) {
					console.error(`[CloudAvailability DO ${this.ctx.id}] Failed to write analytics:`, error);
				}
			}

		} catch (error) {
			const duration = Date.now() - startTime;
			console.error(`[CloudAvailability DO ${this.ctx.id}] Auction import failed after ${duration}ms:`, error);

			// Write error to Analytics Engine if available
			if (this.env.ANALYTICS_ENGINE) {
				try {
					this.env.ANALYTICS_ENGINE.writeDataPoint({
						blobs: ['auction_import', 'error', error instanceof Error ? error.message : String(error)],
						doubles: [duration],
						indexes: ['auction_import_error'],
					});
				} catch (analyticsError) {
					console.error(`[CloudAvailability DO ${this.ctx.id}] Failed to write error analytics:`, analyticsError);
				}
			}

			throw error;
		}
	}

	async detectChanges(
		oldAvailability: AvailabilityMatrix,
		newAvailability: AvailabilityMatrix,
		serverTypes: ServerTypeInfo[],
		locations: LocationInfo[],
	): Promise<AvailabilityChange[]> {
		const changes: AvailabilityChange[] = [];
		const timestamp = Date.now();

		console.log(`[CloudAvailability DO ${this.ctx.id}] Starting change detection...`);
		console.log(`  - Old availability locations: ${Object.keys(oldAvailability).length}`);
		console.log(`  - New availability locations: ${Object.keys(newAvailability).length}`);

		// Create lookup maps
		const serverTypeMap = new Map(serverTypes.map((st) => [st.id, st]));
		const locationMap = new Map(locations.map((loc) => [loc.id, loc]));

		// Check all location/server type combinations
		for (const locationId of Object.keys(newAvailability)) {
			const locId = parseInt(locationId);
			const oldServerTypes = new Set(oldAvailability[locId] || []);
			const newServerTypes = new Set(newAvailability[locId] || []);

			// Find newly available server types
			for (const serverTypeId of newServerTypes) {
				if (!oldServerTypes.has(serverTypeId)) {
					const serverType = serverTypeMap.get(serverTypeId);
					const location = locationMap.get(locId);
					if (serverType && location) {
						console.log(`[CloudAvailability DO ${this.ctx.id}] New availability detected: ${serverType.name} in ${location.name}`);
						changes.push({
							serverTypeId,
							serverTypeName: serverType.name,
							locationId: locId,
							locationName: location.name,
							eventType: 'available',
							timestamp,
						});
					}
				}
			}

			// Find newly unavailable server types
			for (const serverTypeId of oldServerTypes) {
				if (!newServerTypes.has(serverTypeId)) {
					const serverType = serverTypeMap.get(serverTypeId);
					const location = locationMap.get(locId);
					if (serverType && location) {
						console.log(`[CloudAvailability DO ${this.ctx.id}] Lost availability detected: ${serverType.name} in ${location.name}`);
						changes.push({
							serverTypeId,
							serverTypeName: serverType.name,
							locationId: locId,
							locationName: location.name,
							eventType: 'unavailable',
							timestamp,
						});
					}
				}
			}
		}

		// Also check for locations that existed in old but not in new
		for (const locationId of Object.keys(oldAvailability)) {
			const locId = parseInt(locationId);
			if (!newAvailability[locId]) {
				const oldServerTypes = oldAvailability[locId] || [];
				for (const serverTypeId of oldServerTypes) {
					const serverType = serverTypeMap.get(serverTypeId);
					const location = locationMap.get(locId);
					if (serverType && location) {
						changes.push({
							serverTypeId,
							serverTypeName: serverType.name,
							locationId: locId,
							locationName: location.name,
							eventType: 'unavailable',
							timestamp,
						});
					}
				}
			}
		}

		console.log(`[CloudAvailability DO ${this.ctx.id}] Change detection complete. Total changes found: ${changes.length}`);
		return changes;
	}

	async handleAvailabilityChanges(changes: AvailabilityChange[]): Promise<void> {
		console.log(`[CloudAvailability DO ${this.ctx.id}] Handling ${changes.length} availability changes...`);

		// Write to Analytics Engine if available
		if (this.env.ANALYTICS_ENGINE) {
			console.log(`[CloudAvailability DO ${this.ctx.id}] Writing to Analytics Engine...`);
			try {
				await this.writeToAnalyticsEngine(changes);
			} catch (error) {
				console.error(`[CloudAvailability DO ${this.ctx.id}] Failed to write to Analytics Engine:`, error);
			}
		} else {
			console.log(`[CloudAvailability DO ${this.ctx.id}] Analytics Engine not configured, skipping...`);
		}

		// Notify main app if configured
		if (this.env.MAIN_APP_URL && this.env.API_KEY) {
			console.log(`[CloudAvailability DO ${this.ctx.id}] Notifying main app at ${this.env.MAIN_APP_URL}...`);
			try {
				await this.notifyMainApp(changes);
			} catch (error) {
				console.error(`[CloudAvailability DO ${this.ctx.id}] Failed to notify main app:`, error);
			}
		} else {
			console.log(`[CloudAvailability DO ${this.ctx.id}] Main app notification not configured:`);
			console.log(`  - MAIN_APP_URL: ${this.env.MAIN_APP_URL || 'MISSING'}`);
			console.log(`  - API_KEY: ${this.env.API_KEY ? 'Present' : 'MISSING'}`);
			console.log(`  - Note: API_KEY should be set as a secret via 'wrangler secret put API_KEY'`);
		}
	}

	async writeToAnalyticsEngine(changes: AvailabilityChange[]): Promise<void> {
		const serverTypes = (await this.ctx.storage.get<ServerTypeInfo[]>('serverTypes')) || [];
		const serverTypeMap = new Map(serverTypes.map((st) => [st.id, st]));

		for (const change of changes) {
			const serverType = serverTypeMap.get(change.serverTypeId);

			// Write each data point individually
			this.env.ANALYTICS_ENGINE.writeDataPoint({
				blobs: [String(change.serverTypeId), String(change.locationId), change.eventType, change.serverTypeName, change.locationName],
				doubles: [change.eventType === 'available' ? 1 : 0, serverType?.cores || 0, serverType?.memory || 0],
				indexes: [change.serverTypeName], // Using server type name as index
			});
		}

		console.log(`[CloudAvailability DO ${this.ctx.id}] Wrote ${changes.length} data points to Analytics Engine`);
	}

	async notifyMainApp(changes: AvailabilityChange[]): Promise<void> {
		const url = `${this.env.MAIN_APP_URL}/notify`;
		const requestBody = { changes };

		console.log(`[CloudAvailability DO ${this.ctx.id}] Sending notification request:`);
		console.log(`  - URL: ${url}`);
		console.log(`  - Method: POST`);
		console.log(`  - Changes count: ${changes.length}`);
		console.log(`  - Request body: ${JSON.stringify(requestBody, null, 2)}`);

		const startTime = Date.now();

		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${this.env.API_KEY!}`,
					'Content-Type': 'application/json',
					'x-auth-key': this.env.API_KEY!,
				},
				body: JSON.stringify(requestBody),
			});

			const duration = Date.now() - startTime;
			console.log(`[CloudAvailability DO ${this.ctx.id}] Notification response received in ${duration}ms:`);
			console.log(`  - Status: ${response.status} ${response.statusText}`);
			console.log(`  - Headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()))}`);

			const responseText = await response.text();
			console.log(`  - Response body: ${responseText}`);

			if (!response.ok) {
				throw new Error(`Main app notification failed: ${response.status} ${responseText}`);
			}

			console.log(`[CloudAvailability DO ${this.ctx.id}] Successfully notified main app about ${changes.length} changes`);
		} catch (error) {
			console.error(`[CloudAvailability DO ${this.ctx.id}] Notification request failed:`, error);
			if (error instanceof Error) {
				console.error(`  - Error message: ${error.message}`);
				console.error(`  - Error stack: ${error.stack}`);
			}
			throw error;
		}
	}
}

export default class CloudAvailabilityWorker extends WorkerEntrypoint<Env> {
	async fetch(request: Request): Promise<Response> {
		try {
			const durableObjectId = this.env.CLOUD_STATUS_DO.idFromName('singleton-cloud-availability-v1');
			const stub = this.env.CLOUD_STATUS_DO.get(durableObjectId);

			return await stub.fetch(request);
		} catch (e: any) {
			console.error('Error in Worker default fetch:', e);
			return new Response(`Error processing request: ${e.message}`, { status: 500 });
		}
	}

	async getStatus(): Promise<CloudStatusData> {
		try {
			const durableObjectId = this.env.CLOUD_STATUS_DO.idFromName('singleton-cloud-availability-v1');
			const stub = this.env.CLOUD_STATUS_DO.get(durableObjectId);

			return await (stub as any).getStatus();
		} catch (e: any) {
			console.error('Error in Worker getStatus RPC:', e);
			throw new Error(`Error calling getStatus on DO: ${e.message}`);
		}
	}
}
