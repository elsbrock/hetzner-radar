// workers/cloud-availability/src/index.ts
// Import only WorkerEntrypoint explicitly for the default export class
import { WorkerEntrypoint, DurableObject } from "cloudflare:workers";

interface Env {
	// Type the DO namespace with the class it provides
	// Assuming DurableObjectNamespace is available globally/implicitly
	CLOUD_STATUS_DO: DurableObjectNamespace<CloudAvailability>;
	HETZNER_API_TOKEN: string; // Secret expected to be set in Cloudflare dashboard
	FETCH_INTERVAL_MS?: string; // Optional override for fetch interval
}

// --- Basic Hetzner API Types ---
// Based on https://docs.hetzner.cloud/#server-types-get-all-server-types and https://docs.hetzner.cloud/#datacenters-get-all-datacenters
interface HetznerServerType {
	id: number;
	name: string;
	description: string;
	cores: number;
	memory: number;
	disk: number;
	storage_type: 'local' | 'network';
	cpu_type: 'shared' | 'dedicated';
	// ... other properties not strictly needed for availability status
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

// --- Stored State Types ---
interface LocationInfo {
	id: number; // Hetzner Location ID (e.g., 1 for fsn1)
	name: string; // Hetzner Location Name (e.g., "fsn1")
	city: string;
	country: string;
	latitude: number;
	longitude: number;
}

interface ServerTypeInfo {
	id: number;
	name: string;
	description: string;
	cores: number; // Added
	memory: number; // Added
	disk: number; // Added
	cpu_type: 'shared' | 'dedicated'; // Added
}

// Availability Matrix: Map<locationId, Set<availableServerTypeId>>
// Using Record<locationId: number, availableServerTypeIds: number[]> for JSON serializability
type AvailabilityMatrix = Record<number, number[]>;

interface CloudStatusData {
	serverTypes: ServerTypeInfo[];
	locations: LocationInfo[];
	availability: AvailabilityMatrix; // Keyed by Location ID
	lastUpdated: string | null; // ISO string
}

const HETZNER_API_BASE = 'https://api.hetzner.cloud/v1';
// Fetch every minute, but allow override via environment variable for testing
const DEFAULT_FETCH_INTERVAL_MS = 60 * 1000; // 1 minute

// Keep implementing DurableObject (assuming it's globally available)
export class CloudAvailability extends DurableObject {
	// Use 'ctx' as it seems expected by the TS error messages and original code
	ctx: DurableObjectState;
	env: Env;
	fetchIntervalMs: number;
	// Simple in-memory flag to prevent concurrent initializations
	initializing: boolean = false;
	initialized: boolean = false;


	// Constructor receives DurableObjectState (assuming global type) and Env
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);

		this.ctx = ctx; // Assign to 'ctx'
		this.env = env;
		// Allow overriding fetch interval via environment variable if needed
		this.fetchIntervalMs = env.FETCH_INTERVAL_MS ? parseInt(env.FETCH_INTERVAL_MS) : DEFAULT_FETCH_INTERVAL_MS;
	}

	// Centralized initialization logic
	async ensureInitialized(): Promise<void> {
		if (this.initialized || this.initializing) {
			return;
		}
		this.initializing = true;

		try {
			// Check if an alarm is set. If not, set one to run ASAP.
			const currentAlarm = await this.ctx.storage.getAlarm();
			if (currentAlarm === null) {
				console.log(`[CloudAvailability DO ${this.ctx.id}] No alarm set, setting initial alarm.`);
				await this.ctx.storage.setAlarm(Date.now() + 5000); // Set 5 seconds in the future
			}

			// Check if we have *any* data. If not, trigger an immediate fetch.
			// This ensures data is available quickly on first access or after deployment.
			const lastUpdated: string | undefined = await this.ctx.storage.get('lastUpdated');
			if (!lastUpdated) {
				console.log(`[CloudAvailability DO ${this.ctx.id}] No initial data found, fetching immediately.`);
				// Don't await, let it run in background. Errors logged within the method.
				this.fetchAndUpdateStatus().catch(err => console.error(`[CloudAvailability DO ${this.ctx.id}] Initial fetch failed:`, err));
			} else {
				// If data exists, we consider it initialized for serving requests.
				// The alarm will handle periodic updates.
				this.initialized = true;
			}
		} catch (err) {
			console.error(`[CloudAvailability DO ${this.ctx.id}] Initialization check failed:`, err);
			// Decide on error handling: maybe retry initialization? For now, log and potentially remain uninitialized.
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
			// Optional: Implement retry logic or different error handling here.
			// Exponential backoff could be useful if API is temporarily down.
		} finally {
			// Always schedule the next alarm to ensure periodic checks continue.
			const nextAlarmTime = Date.now() + this.fetchIntervalMs;
			await this.ctx.storage.setAlarm(nextAlarmTime);
			console.log(`[CloudAvailability DO ${this.ctx.id}] Next alarm scheduled for: ${new Date(nextAlarmTime).toISOString()}`);
		}
	}

	// Handles HTTP requests routed to this DO instance.
	// Primarily used for the RPC-like '/status' endpoint.
	async fetch(request: Request): Promise<Response> {
		// Ensure initialization logic runs, especially on first access.
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

	// --- RPC Method ---
	// Can be called directly via stub from another Worker/DO, or via fetch('/status').
	async getStatus(): Promise<CloudStatusData> {
		// Ensure initialized before returning data.
		await this.ensureInitialized();

		// Retrieve all parts of the state concurrently.
		const [serverTypes, locations, availability, lastUpdated] = await Promise.all([
			this.ctx.storage.get<ServerTypeInfo[]>('serverTypes'),
			this.ctx.storage.get<LocationInfo[]>('locations'),
			this.ctx.storage.get<AvailabilityMatrix>('availability'),
			this.ctx.storage.get<string>('lastUpdated'),
		]);

		// Return the data, providing defaults for missing pieces.
		return {
			serverTypes: serverTypes || [],
			locations: locations || [],
			availability: availability || {},
			lastUpdated: lastUpdated || null,
		};
	}

	// --- Internal Data Fetching and Processing Logic ---
	async fetchAndUpdateStatus(): Promise<void> {
		const apiToken = this.env.HETZNER_API_TOKEN;
		if (!apiToken) {
			console.error(`[CloudAvailability DO ${this.ctx.id}] HETZNER_API_TOKEN secret is not configured.`);
			// Throwing here prevents scheduling the next alarm if the token is missing.
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
			// Fetch all datacenters to get location info and availability per DC
			const datacentersResponse = await fetch(`${HETZNER_API_BASE}/datacenters?per_page=50`, { headers }); // Ensure pagination limit is high enough
			if (!datacentersResponse.ok) {
				throw new Error(`Failed to fetch datacenters: ${datacentersResponse.status} ${await datacentersResponse.text()}`);
			}
			const datacentersData = (await datacentersResponse.json()) as { datacenters: HetznerDatacenter[] };
			console.log(`[CloudAvailability DO ${this.ctx.id}] Fetched ${datacentersData.datacenters.length} datacenters.`);

			// --- Process Data ---
			const processedServerTypes: ServerTypeInfo[] = serverTypesData.server_types.map(st => ({
				id: st.id,
				name: st.name,
				description: st.description,
				cores: st.cores, // Added
				memory: st.memory, // Added
				disk: st.disk, // Added
				cpu_type: st.cpu_type, // Added
			}));
			processedServerTypes.sort((a, b) => a.name.localeCompare(b.name)); // Sort for consistency

			const processedLocationsMap = new Map<number, LocationInfo>();
			const processedAvailability: AvailabilityMatrix = {}; // Keyed by Location ID

			for (const dc of datacentersData.datacenters) {
				const locId = dc.location.id;

				// Add unique locations using the Location ID
				if (!processedLocationsMap.has(locId)) {
					processedLocationsMap.set(locId, {
						id: locId,
						name: dc.location.name, // Use location name (e.g., "fsn1")
						city: dc.location.city,
						country: dc.location.country,
						latitude: dc.location.latitude,
						longitude: dc.location.longitude,
					});
				}

				// Aggregate available server types per *Location ID*
				// If a server type is available in *any* datacenter within a location, it's available for that location.
				if (!processedAvailability[locId]) {
					processedAvailability[locId] = [];
				}
				const currentAvailable = new Set(processedAvailability[locId]);
				dc.server_types.available.forEach(serverId => currentAvailable.add(serverId));
				// Store sorted array for consistent JSON
				processedAvailability[locId] = Array.from(currentAvailable).sort((a, b) => a - b);
			}

			const processedLocations: LocationInfo[] = Array.from(processedLocationsMap.values());
			processedLocations.sort((a, b) => a.name.localeCompare(b.name)); // Sort for consistency

			const updateTimestamp = new Date().toISOString();

			// --- Store Processed Data ---
			console.log(`[CloudAvailability DO ${this.ctx.id}] Storing processed data...`);
			await this.ctx.storage.put({
				serverTypes: processedServerTypes,
				locations: processedLocations,
				availability: processedAvailability,
				lastUpdated: updateTimestamp,
			});

			// Mark as initialized *after* the first successful fetch and store.
			if (!this.initialized) {
				this.initialized = true;
				console.log(`[CloudAvailability DO ${this.ctx.id}] Initialized successfully.`);
			}
			console.log(`[CloudAvailability DO ${this.ctx.id}] Data stored successfully at ${updateTimestamp}.`);

		} catch (error) {
			console.error(`[CloudAvailability DO ${this.ctx.id}] Error during fetch/update:`, error);
			// Re-throw the error so the alarm handler knows it failed
			throw error;
		}
	}
}

// Default export for the Worker entrypoint, extending WorkerEntrypoint for RPC
export default class CloudAvailabilityWorker extends WorkerEntrypoint<Env> {
	// Handles standard HTTP requests to the worker.
	async fetch(request: Request): Promise<Response> {
		try {
			// Use a fixed name for the singleton DO instance
			const durableObjectId = this.env.CLOUD_STATUS_DO.idFromName("singleton-cloud-availability-v1");
			const stub = this.env.CLOUD_STATUS_DO.get(durableObjectId);

			// Forward the request to the DO instance.
			// The DO's fetch method will handle routing based on the path.
			return await stub.fetch(request);
		} catch (e: any) {
			console.error("Error in Worker default fetch:", e);
			return new Response(`Error processing request: ${e.message}`, { status: 500 });
		}
	}

	// RPC method callable from other workers/services
	async getStatus(): Promise<CloudStatusData> {
		try {
			// Use a fixed name for the singleton DO instance
			const durableObjectId = this.env.CLOUD_STATUS_DO.idFromName("singleton-cloud-availability-v1");
			const stub = this.env.CLOUD_STATUS_DO.get(durableObjectId);

			// Directly call the getStatus method on the DO stub
			// Use type assertion as a workaround for TS inference issues
			return await (stub as any).getStatus();
		} catch (e: any) {
			console.error("Error in Worker getStatus RPC:", e);
			// Re-throw or return a specific error structure if needed for RPC consumers
			throw new Error(`Error calling getStatus on DO: ${e.message}`);
		}
	}
}
