/**
 * Auction Data Transformer
 *
 * Transforms raw Hetzner auction data to match the database schema
 * Based on the transformation logic from scripts/import.py
 */

import type { HetznerAuctionServer } from './hetzner-auction-client';
import cpuSpecs from '../data/cpu-specs.json';

export interface CpuSpecEntry {
	cores: number;
	threads: number;
	score: number;
	multicore_score: number;
	family: string;
}

export interface RawServerData {
	id: number;
	information: string | null;
	datacenter: string;
	location: string;
	cpu_vendor: string;
	cpu: string;
	cpu_count: number;
	is_highio: boolean;
	ram: string;
	ram_size: number;
	is_ecc: boolean;
	hdd_arr: string;
	nvme_count: number;
	nvme_drives: string;
	nvme_size: number;
	sata_count: number;
	sata_drives: string;
	sata_size: number;
	hdd_count: number;
	hdd_drives: string;
	hdd_size: number;
	with_inic: boolean;
	with_hwr: boolean;
	with_gpu: boolean;
	with_rps: boolean;
	traffic: string;
	bandwidth: number;
	price: number;
	fixed_price: boolean;
	seen: string;
	cpu_cores: number | null;
	cpu_threads: number | null;
	cpu_generation: string | null;
	cpu_score: number | null;
	cpu_multicore_score: number | null;
}

export class AuctionDataTransformer {
	private static cpuSpecsMap: Record<string, CpuSpecEntry> = cpuSpecs as Record<string, CpuSpecEntry>;

	/**
	 * Transforms raw Hetzner auction data to database format
	 * @param servers Array of raw server data from Hetzner API
	 * @returns Array of transformed server data ready for database insertion
	 */
	static transformServers(servers: HetznerAuctionServer[]): RawServerData[] {
		const transformedServers: RawServerData[] = [];

		for (const server of servers) {
			try {
				const transformed = this.transformServer(server);
				transformedServers.push(transformed);
			} catch (error) {
				console.error(`[AuctionDataTransformer] Failed to transform server ${server.id}:`, error);
				// Continue processing other servers
			}
		}

		console.log(`[AuctionDataTransformer] Transformed ${transformedServers.length}/${servers.length} servers`);
		return transformedServers;
	}

	/**
	 * Normalizes a Hetzner CPU name for lookup in cpu-specs.json
	 */
	static normalizeCpuName(name: string): string {
		return name
			.replace(/^\d+x\s+/, '') // Remove '2x ' prefix
			.replace(/[®™]/g, '') // Remove trademark symbols
			.replace(/Prozessor\s/g, '') // Remove German 'Prozessor'
			.replace(/\s+/g, ' ') // Collapse whitespace
			.trim();
	}

	/**
	 * Gets the socket count from a raw CPU name (e.g. '2x Intel...' -> 2)
	 */
	static getSocketCount(name: string): number {
		const match = name.match(/^(\d+)x\s+/);
		return match ? parseInt(match[1], 10) : 1;
	}

	/**
	 * Looks up CPU specs for a given raw CPU name
	 */
	static lookupCpuSpecs(rawCpuName: string): {
		cores: number | null;
		threads: number | null;
		generation: string | null;
		score: number | null;
		multicore_score: number | null;
	} {
		const normalized = this.normalizeCpuName(rawCpuName);
		const specs = this.cpuSpecsMap[normalized];

		if (!specs) {
			return { cores: null, threads: null, generation: null, score: null, multicore_score: null };
		}

		const socketCount = this.getSocketCount(rawCpuName);

		return {
			cores: specs.cores * socketCount,
			threads: specs.threads * socketCount,
			generation: specs.family || null,
			score: specs.score,
			multicore_score: specs.multicore_score * socketCount,
		};
	}

	/**
	 * Transforms a single server record
	 */
	private static transformServer(server: HetznerAuctionServer): RawServerData {
		// Calculate location from datacenter (matches import.py logic)
		const location = this.getLocationFromDatacenter(server.datacenter);

		// Extract CPU vendor from CPU string (first word)
		const cpuVendor = this.extractCpuVendor(server.cpu);

		// Calculate seen timestamp from Hetzner's timestamp data
		const seenTimestamp = this.calculateSeenTimestamp(server.next_reduce_timestamp, server.next_reduce);

		// Process drive arrays
		const driveData = this.processDriveData(server.serverDiskData);

		// Look up CPU specs
		const cpuInfo = this.lookupCpuSpecs(server.cpu);

		return {
			id: server.id,
			information: server.information ? JSON.stringify(server.information) : null,
			datacenter: server.datacenter,
			location,
			cpu_vendor: cpuVendor,
			cpu: server.cpu,
			cpu_count: server.cpu_count,
			is_highio: server.is_highio,
			ram: JSON.stringify(server.ram),
			ram_size: server.ram_size,
			is_ecc: server.is_ecc,
			hdd_arr: JSON.stringify(server.hdd_arr),
			nvme_count: driveData.nvme_count,
			nvme_drives: JSON.stringify(driveData.nvme_drives),
			nvme_size: driveData.nvme_size,
			sata_count: driveData.sata_count,
			sata_drives: JSON.stringify(driveData.sata_drives),
			sata_size: driveData.sata_size,
			hdd_count: driveData.hdd_count,
			hdd_drives: JSON.stringify(driveData.hdd_drives),
			hdd_size: driveData.hdd_size,
			with_inic: server.specials?.includes('iNIC') ?? false,
			with_hwr: server.specials?.includes('HWR') ?? false,
			with_gpu: server.specials?.includes('GPU') ?? false,
			with_rps: server.specials?.includes('RPS') ?? false,
			traffic: server.traffic,
			bandwidth: server.bandwidth,
			price: server.price,
			fixed_price: server.fixed_price,
			seen: seenTimestamp,
			cpu_cores: cpuInfo.cores,
			cpu_threads: cpuInfo.threads,
			cpu_generation: cpuInfo.generation,
			cpu_score: cpuInfo.score,
			cpu_multicore_score: cpuInfo.multicore_score,
		};
	}

	/**
	 * Determines location from datacenter name
	 * Matches the logic from import.py
	 */
	private static getLocationFromDatacenter(datacenter: string): string {
		if (datacenter.startsWith('NBG') || datacenter.startsWith('FSN')) {
			return 'Germany';
		}
		return 'Finland';
	}

	/**
	 * Extracts CPU vendor from CPU string (first word)
	 */
	private static extractCpuVendor(cpu: string): string {
		const spaceIndex = cpu.indexOf(' ');
		return spaceIndex !== -1 ? cpu.substring(0, spaceIndex) : cpu;
	}

	/**
	 * Calculates the seen timestamp from Hetzner's timestamp data
	 * Matches the logic from import.py: TO_TIMESTAMP(next_reduce_timestamp - next_reduce)
	 */
	private static calculateSeenTimestamp(nextReduceTimestamp: number, nextReduce: number): string {
		const seenTimestamp = nextReduceTimestamp - nextReduce;
		return new Date(seenTimestamp * 1000).toISOString();
	}

	/**
	 * Processes drive data arrays to calculate counts and sizes
	 * Matches the aggregation logic from import.py
	 */
	private static processDriveData(serverDiskData: HetznerAuctionServer['serverDiskData']) {
		const nvme_drives = serverDiskData.nvme || [];
		const sata_drives = serverDiskData.sata || [];
		const hdd_drives = serverDiskData.hdd || [];

		return {
			nvme_count: nvme_drives.length,
			nvme_drives: nvme_drives,
			nvme_size: nvme_drives.reduce((sum, size) => sum + size, 0),
			sata_count: sata_drives.length,
			sata_drives: sata_drives,
			sata_size: sata_drives.reduce((sum, size) => sum + size, 0),
			hdd_count: hdd_drives.length,
			hdd_drives: hdd_drives,
			hdd_size: hdd_drives.reduce((sum, size) => sum + size, 0),
		};
	}

	/**
	 * Validates transformed data
	 */
	static validateTransformedData(data: RawServerData[]): { valid: RawServerData[]; invalid: number } {
		const valid: RawServerData[] = [];
		let invalid = 0;

		for (const server of data) {
			if (this.isValidServerData(server)) {
				valid.push(server);
			} else {
				invalid++;
				console.warn(`[AuctionDataTransformer] Invalid server data for ID ${server.id}`);
			}
		}

		return { valid, invalid };
	}

	/**
	 * Checks if server data is valid
	 */
	private static isValidServerData(server: RawServerData): boolean {
		return (
			typeof server.id === 'number' &&
			server.id > 0 &&
			typeof server.cpu === 'string' &&
			server.cpu.length > 0 &&
			typeof server.datacenter === 'string' &&
			server.datacenter.length > 0 &&
			typeof server.price === 'number' &&
			server.price > 0 &&
			typeof server.seen === 'string' &&
			server.seen.length > 0
		);
	}
}
