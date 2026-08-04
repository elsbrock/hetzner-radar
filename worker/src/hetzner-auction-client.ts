/**
 * Hetzner Auction API Client
 *
 * Fetches server auction data from Hetzner's API
 */

/**
 * Hetzner's live auction feed as it is served today: one nested document per
 * server, flattened client-side by their own frontend. The per-currency flat
 * feeds (live_data_sb_EUR.json) were retired on 2026-08-04 and now 404.
 */
export interface HetznerAuctionFeedServer {
	Id: number;
	Hardware: {
		CPU: { Name: string; CoreCount: number };
		RAM: { RealSize: number; Size: number; SizeUnit: string; Amount: number; ecc: boolean };
		Storage: {
			RealSize: number;
			Size: number;
			SizeUnit: string;
			Amount: number;
			Disks: string[];
			Details: { nvme: number[]; sata: number[]; hdd: number[]; general: number[] };
		};
	};
	Prices: {
		monthly: { EUR: number; USD: number };
		hourly: { EUR: number; USD: number };
		setup: { EUR: number; USD: number };
		fixed: boolean;
	};
	IPPrices: {
		monthly: { EUR: number; USD: number };
		hourly: { EUR: number; USD: number };
		Amount: number;
	};
	Details: {
		Description: string[];
		Information: string[];
		Specials: string[];
		Traffic: string;
		Bandwidth: number;
		OS: string[];
		Datacenter: { Name: string; Datacenter: string };
	};
	Timer: { ReduceNext: number; ReduceNextHr: boolean; ReduceNextTimestamp: number };
}

export interface HetznerAuctionResponse {
	server: HetznerAuctionFeedServer[];
}

/**
 * The flat record the rest of the worker (and the DuckDB import) works with.
 * Hetzner used to ship this directly; `transformFeedServer` rebuilds it.
 */
export interface HetznerAuctionServer {
	id: number;
	information: string[] | null;
	cpu: string;
	cpu_count: number;
	is_highio: boolean;
	traffic: string;
	bandwidth: number;
	ram: string[];
	ram_size: number;
	price: number;
	hdd_arr: string[];
	serverDiskData: {
		nvme: number[];
		sata: number[];
		hdd: number[];
		general: number[];
	};
	is_ecc: boolean;
	datacenter: string;
	specials: string[];
	fixed_price: boolean;
	next_reduce_timestamp: number;
	next_reduce: number;
	/**
	 * Pricing fields the transformer drops but the MCP snapshot resolves.
	 * `ip_price` is an object in the live feed, not a scalar.
	 */
	ip_price?: {
		Monthly: number;
		Hourly: number;
		Amount: number;
	};
	setup_price?: number;
	hourly_price?: number;
}

/**
 * Flattens one feed record, mirroring the mapping Hetzner's Serverbörse
 * frontend applies to the same document.
 */
export function transformFeedServer(raw: HetznerAuctionFeedServer): HetznerAuctionServer {
	const { Hardware: hardware, Details: details, Prices: prices, IPPrices: ipPrices, Timer: timer } = raw;
	const information = details.Information ?? [];
	const specials = details.Specials ?? [];
	const disks = hardware.Storage.Details ?? { nvme: [], sata: [], hdd: [], general: [] };

	return {
		id: raw.Id,
		information,
		cpu: hardware.CPU.Name,
		cpu_count: hardware.CPU.CoreCount,
		// The feed no longer carries a HighIO flag of its own; it only ever
		// shows up as a special now.
		is_highio: specials.includes('HighIO'),
		traffic: details.Traffic,
		bandwidth: details.Bandwidth,
		// The retired flat feed sent RAM as its human-readable description lines.
		ram: information.filter((line) => line.includes('RAM')),
		ram_size: hardware.RAM.Size,
		price: prices.monthly.EUR,
		hdd_arr: hardware.Storage.Disks ?? [],
		serverDiskData: {
			nvme: disks.nvme ?? [],
			sata: disks.sata ?? [],
			hdd: disks.hdd ?? [],
			general: disks.general ?? [],
		},
		is_ecc: Boolean(hardware.RAM.ecc),
		datacenter: details.Datacenter.Name,
		specials,
		fixed_price: Boolean(prices.fixed),
		next_reduce_timestamp: timer?.ReduceNextTimestamp ?? 0,
		next_reduce: timer?.ReduceNext ?? 0,
		ip_price: {
			Monthly: ipPrices.monthly.EUR,
			Hourly: ipPrices.hourly.EUR,
			Amount: ipPrices.Amount,
		},
		setup_price: prices.setup.EUR,
		hourly_price: prices.hourly.EUR,
	};
}

export class HetznerAuctionClient {
	private readonly apiUrl: string;
	private readonly userAgent: string;

	constructor(apiUrl: string) {
		this.apiUrl = apiUrl;
		this.userAgent = 'Hetzner-Radar-AuctionImport-Worker (https://github.com/elsbrock/hetzner-radar)';
	}

	/**
	 * Fetches server auction data from Hetzner API
	 * @returns Array of server auction data
	 * @throws Error if the request fails
	 */
	async fetchAuctionData(): Promise<HetznerAuctionServer[]> {
		const maxRetries = 3;
		let lastError: Error | null = null;

		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				console.log(`[HetznerAuctionClient] Fetching auction data, attempt ${attempt}/${maxRetries}`);

				const response = await fetch(this.apiUrl, {
					headers: {
						'User-Agent': this.userAgent,
						Accept: 'application/json',
						'Accept-Encoding': 'gzip, deflate',
					},
					cf: {
						// Cache the response for 1 minute to avoid hammering the API
						cacheTtl: 60,
						cacheEverything: true,
					},
				});

				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
				}

				const data = (await response.json()) as HetznerAuctionResponse;

				if (!data.server || !Array.isArray(data.server)) {
					throw new Error('Invalid response format: missing or invalid server array');
				}

				console.log(`[HetznerAuctionClient] Successfully fetched ${data.server.length} servers`);
				return data.server.map(transformFeedServer);
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));
				console.error(`[HetznerAuctionClient] Attempt ${attempt} failed:`, lastError.message);

				if (attempt < maxRetries) {
					// Exponential backoff: 1s, 2s, 4s
					const delay = Math.pow(2, attempt - 1) * 1000;
					console.log(`[HetznerAuctionClient] Retrying in ${delay}ms...`);
					await new Promise((resolve) => setTimeout(resolve, delay));
				}
			}
		}

		throw new Error(`Failed to fetch auction data after ${maxRetries} attempts: ${lastError?.message}`);
	}

	/**
	 * Validates that a server object has all required fields
	 */
	static validateServer(server: unknown): server is HetznerAuctionServer {
		// Narrow before reading properties: this is fed straight from the Hetzner
		// API response, so a null or primitive would otherwise throw a TypeError
		// here instead of being reported as invalid.
		if (typeof server !== 'object' || server === null) return false;
		const s = server as Record<string, unknown>;

		return (
			typeof s.id === 'number' &&
			typeof s.cpu === 'string' &&
			typeof s.cpu_count === 'number' &&
			typeof s.price === 'number' &&
			typeof s.datacenter === 'string' &&
			Array.isArray(s.hdd_arr) &&
			typeof s.serverDiskData === 'object' &&
			s.serverDiskData !== null
		);
	}
}
