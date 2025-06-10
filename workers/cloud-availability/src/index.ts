import { WorkerEntrypoint, DurableObject } from "cloudflare:workers";

/**
 * Cloud Availability Worker
 * 
 * Required secrets (set via wrangler secret put):
 * - HETZNER_API_TOKEN: Token for accessing Hetzner Cloud API
 * - API_KEY: Authentication key for notifying the main app
 * 
 * Environment variables (set in wrangler.jsonc):
 * - MAIN_APP_URL: URL of the main application (e.g., https://radar.iodev.org)
 * - FETCH_INTERVAL_MS: How often to check Hetzner API (default: 60000ms)
 */

interface Env {
 	CLOUD_STATUS_DO: DurableObjectNamespace<CloudAvailability>;
 	HETZNER_API_TOKEN: string;
 	FETCH_INTERVAL_MS?: string;
 	ANALYTICS_ENGINE: AnalyticsEngineDataset;
 	MAIN_APP_URL?: string;
 	API_KEY?: string;
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

interface CloudStatusData {
	serverTypes: ServerTypeInfo[];
	locations: LocationInfo[];
	availability: AvailabilityMatrix;
	lastUpdated: string | null;
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

export class CloudAvailability extends DurableObject {
	ctx: DurableObjectState;
	env: Env;
	fetchIntervalMs: number;
	initializing: boolean = false;
	initialized: boolean = false;


	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);

		this.ctx = ctx;
		this.env = env;
		this.fetchIntervalMs = env.FETCH_INTERVAL_MS ? parseInt(env.FETCH_INTERVAL_MS) : DEFAULT_FETCH_INTERVAL_MS;
		
		// Log environment variable presence
		console.log(`[CloudAvailability DO ${this.ctx.id}] Environment variables check:`);
		console.log(`  - HETZNER_API_TOKEN: ${env.HETZNER_API_TOKEN ? 'Present' : 'MISSING'}`);
		console.log(`  - MAIN_APP_URL: ${env.MAIN_APP_URL ? `Present (${env.MAIN_APP_URL})` : 'MISSING'}`);
		console.log(`  - API_KEY: ${env.API_KEY ? 'Present' : 'MISSING'}`);
		console.log(`  - ANALYTICS_ENGINE: ${env.ANALYTICS_ENGINE ? 'Present' : 'MISSING'}`);
		console.log(`  - FETCH_INTERVAL_MS: ${this.fetchIntervalMs}ms`);
	}

	async ensureInitialized(): Promise<void> {
		if (this.initialized || this.initializing) {
			console.log(`[CloudAvailability DO ${this.ctx.id}] Already initialized=${this.initialized} or initializing=${this.initializing}, skipping...`);
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
			console.log(`[CloudAvailability DO ${this.ctx.id}] Last updated: ${lastUpdated || 'never'}`);
			
			if (!lastUpdated) {
				console.log(`[CloudAvailability DO ${this.ctx.id}] No initial data found, fetching immediately.`);
				this.fetchAndUpdateStatus().catch(err => console.error(`[CloudAvailability DO ${this.ctx.id}] Initial fetch failed:`, err));
			} else {
				console.log(`[CloudAvailability DO ${this.ctx.id}] Initial data exists, marking as initialized.`);
				this.initialized = true;
			}
		} catch (err) {
			console.error(`[CloudAvailability DO ${this.ctx.id}] Initialization check failed:`, err);
		} finally {
			this.initializing = false;
		}
	}


	async alarm(): Promise<void> {
		console.log(`[CloudAvailability DO ${this.ctx.id}] Alarm triggered, fetching Hetzner status...`);
		try {
			await this.fetchAndUpdateStatus();
			console.log(`[CloudAvailability DO ${this.ctx.id}] Hetzner status updated successfully.`);
		} catch (error) {
			console.error(`[CloudAvailability DO ${this.ctx.id}] Failed to update Hetzner status in alarm:`, error);
		} finally {
			const nextAlarmTime = Date.now() + this.fetchIntervalMs;
			await this.ctx.storage.setAlarm(nextAlarmTime);
			console.log(`[CloudAvailability DO ${this.ctx.id}] Next alarm scheduled for: ${new Date(nextAlarmTime).toISOString()}`);
		}
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

		return new Response('Not found. Use GET /status', { status: 404 });
	}

	async getStatus(): Promise<CloudStatusData> {
		await this.ensureInitialized();

		const [serverTypes, locations, availability, lastUpdated] = await Promise.all([
			this.ctx.storage.get<ServerTypeInfo[]>('serverTypes'),
			this.ctx.storage.get<LocationInfo[]>('locations'),
			this.ctx.storage.get<AvailabilityMatrix>('availability'),
			this.ctx.storage.get<string>('lastUpdated'),
		]);

		return {
			serverTypes: serverTypes || [],
			locations: locations || [],
			availability: availability || {},
			lastUpdated: lastUpdated || null,
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

			const processedServerTypes: ServerTypeInfo[] = serverTypesData.server_types.map(st => ({
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
				const currentAvailable = new Set(processedAvailability[locId]);
				dc.server_types.available.forEach(serverId => currentAvailable.add(serverId));
				processedAvailability[locId] = Array.from(currentAvailable).sort((a, b) => a - b);
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
			
			const updateTimestamp = new Date().toISOString();

			console.log(`[CloudAvailability DO ${this.ctx.id}] Storing processed data...`);
			await this.ctx.storage.put({
				serverTypes: processedServerTypes,
				locations: processedLocations,
				availability: processedAvailability,
				lastUpdated: updateTimestamp,
			});

			// Detect and handle changes
			console.log(`[CloudAvailability DO ${this.ctx.id}] Change detection: initialized=${this.initialized}, previousAvailability=${previousAvailability ? 'exists' : 'null'}`);
			
			if (previousAvailability && this.initialized) {
				console.log(`[CloudAvailability DO ${this.ctx.id}] Running change detection...`);
				const changes = await this.detectChanges(
					previousAvailability, 
					processedAvailability, 
					processedServerTypes, 
					processedLocations
				);
				
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
				if (!previousAvailability) {
					console.log(`[CloudAvailability DO ${this.ctx.id}] Skipping change detection: no previous availability data`);
				}
				if (!this.initialized) {
					console.log(`[CloudAvailability DO ${this.ctx.id}] Skipping change detection: not yet initialized`);
				}
			}

			if (!this.initialized) {
				this.initialized = true;
				console.log(`[CloudAvailability DO ${this.ctx.id}] Initialized successfully.`);
			}
			console.log(`[CloudAvailability DO ${this.ctx.id}] Data stored successfully at ${updateTimestamp}.`);

		} catch (error) {
			console.error(`[CloudAvailability DO ${this.ctx.id}] Error during fetch/update:`, error);
			throw error;
		}
	}

	async detectChanges(
		oldAvailability: AvailabilityMatrix,
		newAvailability: AvailabilityMatrix,
		serverTypes: ServerTypeInfo[],
		locations: LocationInfo[]
	): Promise<AvailabilityChange[]> {
		const changes: AvailabilityChange[] = [];
		const timestamp = Date.now();

		console.log(`[CloudAvailability DO ${this.ctx.id}] Starting change detection...`);
		console.log(`  - Old availability locations: ${Object.keys(oldAvailability).length}`);
		console.log(`  - New availability locations: ${Object.keys(newAvailability).length}`);

		// Create lookup maps
		const serverTypeMap = new Map(serverTypes.map(st => [st.id, st]));
		const locationMap = new Map(locations.map(loc => [loc.id, loc]));

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
							timestamp
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
							timestamp
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
							timestamp
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
		const serverTypes = await this.ctx.storage.get<ServerTypeInfo[]>('serverTypes') || [];
		const serverTypeMap = new Map(serverTypes.map(st => [st.id, st]));

		for (const change of changes) {
			const serverType = serverTypeMap.get(change.serverTypeId);
			
			// Write each data point individually
			this.env.ANALYTICS_ENGINE.writeDataPoint({
				blobs: [
					String(change.serverTypeId),
					String(change.locationId),
					change.eventType,
					change.serverTypeName,
					change.locationName
				],
				doubles: [
					change.eventType === 'available' ? 1 : 0,
					serverType?.cores || 0,
					serverType?.memory || 0
				],
				indexes: [change.serverTypeName] // Using server type name as index
			});
		}

		console.log(`[CloudAvailability DO ${this.ctx.id}] Wrote ${changes.length} data points to Analytics Engine`);
	}

	async notifyMainApp(changes: AvailabilityChange[]): Promise<void> {
		const url = `${this.env.MAIN_APP_URL}/(internal)/notify`;
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
					'Authorization': `Bearer ${this.env.API_KEY}`,
					'Content-Type': 'application/json',
					'x-auth-key': this.env.API_KEY
				},
				body: JSON.stringify(requestBody)
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
			const durableObjectId = this.env.CLOUD_STATUS_DO.idFromName("singleton-cloud-availability-v1");
			const stub = this.env.CLOUD_STATUS_DO.get(durableObjectId);

			return await stub.fetch(request);
		} catch (e: any) {
			console.error("Error in Worker default fetch:", e);
			return new Response(`Error processing request: ${e.message}`, { status: 500 });
		}
	}

	async getStatus(): Promise<CloudStatusData> {
		try {
			const durableObjectId = this.env.CLOUD_STATUS_DO.idFromName("singleton-cloud-availability-v1");
			const stub = this.env.CLOUD_STATUS_DO.get(durableObjectId);

			return await (stub as any).getStatus();
		} catch (e: any) {
			console.error("Error in Worker getStatus RPC:", e);
			throw new Error(`Error calling getStatus on DO: ${e.message}`);
		}
	}
}
