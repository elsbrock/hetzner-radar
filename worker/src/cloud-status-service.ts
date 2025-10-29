/**
 * Cloud Status Service
 *
 * Handles Hetzner Cloud server availability tracking
 */

interface HetznerServerType {
	id: number;
	name: string;
	description: string;
	cores: number;
	memory: number;
	disk: number;
	storage_type: 'local' | 'network';
	cpu_type: 'shared' | 'dedicated';
	category: string;
	architecture: string;
	deprecation: {
		unavailable_after: string;
		announced: string;
	} | null;
}

interface HetznerPaginationMeta {
    page: number;
    per_page: number;
    previous_page: number | null;
    next_page: number | null;
    last_page: number;
    total_entries: number;
}

interface HetznerPaginatedResponse<T> {
    [key: string]: T[] | unknown;
    meta?: {
        pagination?: HetznerPaginationMeta;
    };
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
	name: string;
	description: string;
	location: HetznerLocation;
	server_types: {
		supported: number[];
		available: number[];
		available_for_migration: number[];
	};
}

export interface LocationInfo {
	id: number;
	name: string;
	city: string;
	country: string;
	latitude: number;
	longitude: number;
}

export interface ServerTypeInfo {
	id: number;
	name: string;
	description: string;
	cores: number;
	memory: number;
	disk: number;
	cpu_type: 'shared' | 'dedicated';
	architecture: string;
	category: string;
	storageType: 'local' | 'network';
	isDeprecated: boolean;
	deprecated: boolean;
}

export type AvailabilityMatrix = Record<number, number[]>;
export type SupportMatrix = Record<number, number[]>;
export type LastSeenMatrix = Record<string, string>;

export interface CloudStatusData {
	serverTypes: ServerTypeInfo[];
	locations: LocationInfo[];
	availability: AvailabilityMatrix;
	supported: SupportMatrix;
	lastUpdated: string | null;
	lastSeenAvailable?: LastSeenMatrix;
}

export interface AvailabilityChange {
	serverTypeId: number;
	serverTypeName: string;
	locationId: number;
	locationName: string;
	eventType: 'available' | 'unavailable';
	timestamp: number;
}

const HETZNER_API_BASE = 'https://api.hetzner.cloud/v1';

export class CloudStatusService {
	private apiToken: string;
	private storage: DurableObjectStorage;
	private doId: string;

	constructor(apiToken: string, storage: DurableObjectStorage, doId: string) {
		this.apiToken = apiToken;
		this.storage = storage;
		this.doId = doId;
	}

	async getStatus(): Promise<CloudStatusData> {
		const [serverTypes, locations, availability, supported, lastUpdated, lastSeenAvailable] = await Promise.all([
			this.storage.get<ServerTypeInfo[]>('serverTypes'),
			this.storage.get<LocationInfo[]>('locations'),
			this.storage.get<AvailabilityMatrix>('availability'),
			this.storage.get<SupportMatrix>('supported'),
			this.storage.get<string>('lastUpdated'),
			this.storage.get<LastSeenMatrix>('lastSeenAvailable'),
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

	async fetchAndUpdateStatus(): Promise<AvailabilityChange[]> {
		console.log(`[CloudStatusService ${this.doId}] fetchAndUpdateStatus called at ${new Date().toISOString()}`);

		if (!this.apiToken) {
			console.error(`[CloudStatusService ${this.doId}] HETZNER_API_TOKEN is not configured.`);
			throw new Error('HETZNER_API_TOKEN is not configured.');
		}

		const headers = {
			Authorization: `Bearer ${this.apiToken}`,
			'User-Agent': 'Hetzner-Radar-CloudAvailability-Monitor (https://github.com/elsbrock/hetzner-radar)',
		};

		try {
			console.log(`[CloudStatusService ${this.doId}] Fetching server types...`);
			const serverTypes = await this.fetchPaginatedResource<HetznerServerType>({
				path: 'server_types',
				dataKey: 'server_types',
				headers,
				resourceName: 'server types',
			});
			console.log(`[CloudStatusService ${this.doId}] Fetched ${serverTypes.length} server types.`);
			console.log(
				`[CloudStatusService ${this.doId}] Server type preview: ${serverTypes
					.slice(0, 20)
					.map((st) => `${st.name}(${st.category || 'unknown'})`)
					.join(', ')}`,
			);

            console.log(`[CloudStatusService ${this.doId}] Fetching datacenters...`);
            const datacenters = await this.fetchPaginatedResource<HetznerDatacenter>({
                path: 'datacenters',
                dataKey: 'datacenters',
                headers,
                resourceName: 'datacenters',
            });
            console.log(`[CloudStatusService ${this.doId}] Fetched ${datacenters.length} datacenters.`);

			const processedData = this.processCloudData(serverTypes, datacenters);

			// Get previous availability for change detection
			const previousAvailability = await this.storage.get<AvailabilityMatrix>('availability');

			// Update last seen availability timestamps
			const updatedLastSeen = await this.updateLastSeenTimestamps(processedData.availability);

			// Store processed data
			const updateTimestamp = new Date().toISOString();
			await this.storage.put({
				serverTypes: processedData.serverTypes,
				locations: processedData.locations,
				availability: processedData.availability,
				supported: processedData.supported,
				lastUpdated: updateTimestamp,
				lastSeenAvailable: updatedLastSeen,
			});

			// Return changes for handling by the main class
			const changes = previousAvailability
				? this.detectChanges(previousAvailability, processedData.availability, processedData.serverTypes, processedData.locations)
				: [];

			console.log(`[CloudStatusService ${this.doId}] Data stored successfully at ${updateTimestamp}.`);
			return changes;
		} catch (error) {
			console.error(`[CloudStatusService ${this.doId}] Error during fetch/update:`, error);
			throw error;
		}
	}

	private async fetchPaginatedResource<T>({
		path,
		dataKey,
		headers,
		resourceName,
	}: {
		path: string;
		dataKey: string;
		headers: Record<string, string>;
		resourceName: string;
	}): Promise<T[]> {
		const results: T[] = [];
		let page = 1;
		const perPage = 50;

		while (true) {
			const url = new URL(`${HETZNER_API_BASE}/${path}`);
			url.searchParams.set('page', page.toString());
			url.searchParams.set('per_page', perPage.toString());

			const response = await fetch(url.toString(), { headers });
			if (!response.ok) {
				throw new Error(`Failed to fetch ${resourceName}: ${response.status} ${await response.text()}`);
			}

			const data = (await response.json()) as HetznerPaginatedResponse<T>;
			const items = data[dataKey];
			if (!Array.isArray(items)) {
				throw new Error(`Invalid ${resourceName} response: missing ${dataKey} array`);
			}

			results.push(...(items as T[]));

			const nextPage = data.meta?.pagination?.next_page;
			if (!nextPage || nextPage === page) {
				break;
			}

			page = nextPage;
		}

		return results;
	}

	private processCloudData(serverTypes: HetznerServerType[], datacenters: HetznerDatacenter[]) {
		const processedServerTypes: ServerTypeInfo[] = serverTypes.map((st) => ({
			id: st.id,
			name: st.name,
			description: st.description,
			cores: st.cores,
			memory: st.memory,
			disk: st.disk,
			cpu_type: st.cpu_type,
			architecture: st.architecture,
			category: st.category,
			storageType: st.storage_type,
			isDeprecated: st.deprecation !== null,
			deprecated: st.deprecation !== null,
		}));
		processedServerTypes.sort((a, b) => a.name.localeCompare(b.name));

		const processedLocationsMap = new Map<number, LocationInfo>();
		const processedAvailability: AvailabilityMatrix = {};
		const processedSupported: SupportMatrix = {};

		for (const dc of datacenters) {
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

			if (!processedAvailability[locId]) processedAvailability[locId] = [];
			if (!processedSupported[locId]) processedSupported[locId] = [];

			const currentAvailable = new Set(processedAvailability[locId]);
			dc.server_types.available.forEach((serverId) => currentAvailable.add(serverId));
			processedAvailability[locId] = Array.from(currentAvailable).sort((a, b) => a - b);

			const currentSupported = new Set(processedSupported[locId]);
			dc.server_types.supported.forEach((serverId) => currentSupported.add(serverId));
			processedSupported[locId] = Array.from(currentSupported).sort((a, b) => a - b);
		}

		const processedLocations: LocationInfo[] = Array.from(processedLocationsMap.values());
		processedLocations.sort((a, b) => a.name.localeCompare(b.name));

		return {
			serverTypes: processedServerTypes,
			locations: processedLocations,
			availability: processedAvailability,
			supported: processedSupported,
		};
	}

	private async updateLastSeenTimestamps(availability: AvailabilityMatrix): Promise<LastSeenMatrix> {
		const existingLastSeen = (await this.storage.get<LastSeenMatrix>('lastSeenAvailable')) || {};
		const updatedLastSeen = { ...existingLastSeen };
		const updateTimestamp = new Date().toISOString();

		let lastSeenUpdates = 0;
		for (const [locationId, availableServerTypes] of Object.entries(availability)) {
			for (const serverTypeId of availableServerTypes) {
				const key = `${locationId}-${serverTypeId}`;
				updatedLastSeen[key] = updateTimestamp;
				lastSeenUpdates++;
			}
		}

		console.log(`[CloudStatusService ${this.doId}] Updated ${lastSeenUpdates} last seen timestamps`);
		return updatedLastSeen;
	}

	private detectChanges(
		oldAvailability: AvailabilityMatrix,
		newAvailability: AvailabilityMatrix,
		serverTypes: ServerTypeInfo[],
		locations: LocationInfo[],
	): AvailabilityChange[] {
		const changes: AvailabilityChange[] = [];
		const timestamp = Date.now();

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

		return changes;
	}
}
