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
	locations: HetznerServerTypeLocation[];
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

/**
 * Per-location availability of a server type, from `GET /v1/server_types`.
 *
 * `available` is Hetzner's current answer to "can this type be created here
 * right now". Their wording is deliberately hedged — "only an indicator whether
 * resources are currently available and is no guarantee" — so treat it as the
 * best signal on offer, not a promise that an order will succeed.
 *
 * A location appearing in this list is what "supported" now means: the
 * deprecated `datacenter.server_types.supported` has no direct successor.
 */
interface HetznerServerTypeLocation {
	id: number;
	name: string;
	available: boolean;
	recommended: boolean;
	deprecation: {
		unavailable_after: string;
		announced: string;
	} | null;
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

/**
 * Bumped whenever the availability source or algorithm changes shape (e.g.
 * the `datacenter.server_types` -> `server_type.locations` migration). A
 * mismatch on the stored version means `previousAvailability` was computed
 * by different logic than the current run, so it is not a meaningful basis
 * for change detection — diffing against it would report the algorithm
 * switch itself as real availability changes.
 */
const AVAILABILITY_ALGORITHM_VERSION = 2;

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

			console.log(`[CloudStatusService ${this.doId}] Fetching locations...`);
			const locations = await this.fetchPaginatedResource<HetznerLocation>({
				path: 'locations',
				dataKey: 'locations',
				headers,
				resourceName: 'locations',
			});
			console.log(`[CloudStatusService ${this.doId}] Fetched ${locations.length} locations.`);

			const processedData = this.processCloudData(serverTypes, locations);

			// Get previous availability for change detection, along with the
			// algorithm version it was computed under.
			const [previousAvailability, previousAlgorithmVersion] = await Promise.all([
				this.storage.get<AvailabilityMatrix>('availability'),
				this.storage.get<number>('availabilityAlgorithmVersion'),
			]);

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
				availabilityAlgorithmVersion: AVAILABILITY_ALGORITHM_VERSION,
			});

			// Return changes for handling by the main class. Skip detection across
			// an algorithm version change: the stored `previousAvailability` was
			// computed differently and diffing against it would surface the
			// migration itself as availability changes.
			const changes =
				previousAvailability && previousAlgorithmVersion === AVAILABILITY_ALGORITHM_VERSION
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

	/**
	 * Fold `/v1/server_types` and `/v1/locations` into the location-keyed
	 * matrices the app renders.
	 *
	 * Availability is read from `server_type.locations[]`, which is Hetzner's
	 * supported source since they deprecated `datacenter.server_types` on
	 * 2026-04-01 — along with the guarantee that it stays accurate. It had
	 * drifted: as of 2026-08-22 the deprecated field claimed every CAX type was
	 * available in fsn1/nbg1/hel1 while `server_types` correctly reported all
	 * twelve pairs unavailable, and it omitted cpx12 from `supported` entirely.
	 */
	private processCloudData(serverTypes: HetznerServerType[], locations: HetznerLocation[]) {
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

		// Dedup by id: fetchPaginatedResource concatenates pages verbatim, so a
		// location shifting across a page boundary between two page requests
		// would otherwise produce a duplicate id, which breaks Svelte's keyed
		// `{#each ... (location.id)}` blocks on the cloud-status page.
		const processedLocationsMap = new Map<number, LocationInfo>();
		for (const loc of locations) {
			processedLocationsMap.set(loc.id, {
				id: loc.id,
				name: loc.name,
				city: loc.city,
				country: loc.country,
				latitude: loc.latitude,
				longitude: loc.longitude,
			});
		}
		const processedLocations: LocationInfo[] = Array.from(processedLocationsMap.values());
		processedLocations.sort((a, b) => a.name.localeCompare(b.name));

		// Seed every known location so one offering nothing still renders as an
		// empty column rather than disappearing from the grid.
		const availableIds = new Map<number, Set<number>>();
		const supportedIds = new Map<number, Set<number>>();
		for (const loc of processedLocations) {
			availableIds.set(loc.id, new Set());
			supportedIds.set(loc.id, new Set());
		}

		for (const st of serverTypes) {
			for (const loc of st.locations ?? []) {
				// Keyed off the locations endpoint, so a type naming a location it did
				// not return has nowhere to record it. That should not happen — log it
				// so a real disagreement between the two endpoints is visible instead
				// of silently vanishing from both matrices.
				if (!supportedIds.has(loc.id)) {
					console.warn(
						`[CloudStatusService ${this.doId}] Server type ${st.name} (${st.id}) references location ${loc.name} (${loc.id}), which was not returned by /v1/locations. Skipping this pairing.`,
					);
					continue;
				}
				supportedIds.get(loc.id)!.add(st.id);
				if (loc.available) availableIds.get(loc.id)!.add(st.id);
			}
		}

		const processedAvailability: AvailabilityMatrix = {};
		const processedSupported: SupportMatrix = {};
		for (const [locId, ids] of availableIds) {
			processedAvailability[locId] = Array.from(ids).sort((a, b) => a - b);
		}
		for (const [locId, ids] of supportedIds) {
			processedSupported[locId] = Array.from(ids).sort((a, b) => a - b);
		}

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
