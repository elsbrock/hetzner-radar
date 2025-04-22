 import { WorkerEntrypoint, DurableObject } from "cloudflare:workers";

 interface Env {
 	CLOUD_STATUS_DO: DurableObjectNamespace<CloudAvailability>;
 	HETZNER_API_TOKEN: string;
 	FETCH_INTERVAL_MS?: string;
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
	}

	async ensureInitialized(): Promise<void> {
		if (this.initialized || this.initializing) {
			return;
		}
		this.initializing = true;

		try {
			const currentAlarm = await this.ctx.storage.getAlarm();
			if (currentAlarm === null) {
				console.log(`[CloudAvailability DO ${this.ctx.id}] No alarm set, setting initial alarm.`);
				await this.ctx.storage.setAlarm(Date.now() + 5000);
			}

			const lastUpdated: string | undefined = await this.ctx.storage.get('lastUpdated');
			if (!lastUpdated) {
				console.log(`[CloudAvailability DO ${this.ctx.id}] No initial data found, fetching immediately.`);
				this.fetchAndUpdateStatus().catch(err => console.error(`[CloudAvailability DO ${this.ctx.id}] Initial fetch failed:`, err));
			} else {
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

			const updateTimestamp = new Date().toISOString();

			console.log(`[CloudAvailability DO ${this.ctx.id}] Storing processed data...`);
			await this.ctx.storage.put({
				serverTypes: processedServerTypes,
				locations: processedLocations,
				availability: processedAvailability,
				lastUpdated: updateTimestamp,
			});

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
