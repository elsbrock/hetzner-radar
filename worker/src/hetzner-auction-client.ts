/**
 * Hetzner Auction API Client
 *
 * Fetches server auction data from Hetzner's API
 */

export interface HetznerAuctionResponse {
	server: HetznerAuctionServer[];
}

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
				return data.server;
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
