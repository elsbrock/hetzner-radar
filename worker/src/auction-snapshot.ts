/**
 * Builds the auction snapshot written to KV after each import.
 *
 * The public MCP server (`src/routes/mcp/+server.ts`) reads this instead of
 * querying D1 — the whole live dataset is a few hundred rows / ~8-20 KB gzipped,
 * so filtering in memory is cheaper and simpler than SQL, and costs zero D1 rows
 * read.
 *
 * The payload shape lives in `@server-radar/filter-spec/snapshot` and is shared
 * with the reader. It used to be hand-mirrored on both sides, from a time when
 * this repo could not share code across the worker/app workspace boundary.
 */
import type { HetznerAuctionServer } from './hetzner-auction-client';
import type { RawServerData } from './auction-data-transformer';
import {
	SNAPSHOT_KEY,
	SNAPSHOT_VERSION,
	type AuctionSnapshot,
	type SnapshotAuction,
	type SnapshotPricing,
} from '@server-radar/filter-spec/snapshot';

export { SNAPSHOT_KEY, SNAPSHOT_VERSION };
export type { AuctionSnapshot, SnapshotAuction, SnapshotPricing };

/** Fallback if the feed ever stops sending ip_price. Mirrors HETZNER_IPV4_COST_CENTS. */
const FALLBACK_IPV4_MONTHLY_EUR = 1.7;

function parseJsonArray<T>(raw: string | null): T[] {
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? (parsed as T[]) : [];
	} catch {
		return [];
	}
}

function resolvePricing(raw: HetznerAuctionServer | undefined, transformed: RawServerData): SnapshotPricing {
	// ip_price is an object ({Monthly, Hourly, Amount}) in the live feed, not a
	// scalar — read Monthly rather than coercing the whole thing to a number.
	const ipv4Monthly = raw?.ip_price?.Monthly ?? FALLBACK_IPV4_MONTHLY_EUR;
	const monthlyNet = transformed.price;
	const setupNet = raw?.setup_price ?? 0;

	// next_reduce_timestamp is unix seconds. Fixed-price servers still carry a
	// timestamp in the feed, but it is meaningless for them.
	const nextReduce = raw?.next_reduce_timestamp;
	const nextReduceAt =
		!transformed.fixed_price && typeof nextReduce === 'number' && nextReduce > 0 ? new Date(nextReduce * 1000).toISOString() : null;

	return {
		currency: 'EUR',
		monthly_net: monthlyNet,
		ipv4_monthly: ipv4Monthly,
		setup_net: setupNet,
		total_monthly_net: Math.round((monthlyNet + ipv4Monthly) * 100) / 100,
		vat_included: false,
		fixed_price: transformed.fixed_price,
		next_reduce_at: nextReduceAt,
	};
}

/**
 * Builds the snapshot from both representations: the transformed records carry
 * the CPU enrichment and normalised drive arrays, while the raw feed still has
 * the pricing fields the transformer drops (ip_price, setup_price,
 * next_reduce_timestamp).
 */
export function buildSnapshot(transformed: RawServerData[], rawServers: HetznerAuctionServer[], generatedAt: string): AuctionSnapshot {
	const rawById = new Map<number, HetznerAuctionServer>();
	for (const server of rawServers) rawById.set(server.id, server);

	const auctions: SnapshotAuction[] = transformed.map((t) => ({
		id: t.id,
		datacenter: t.datacenter,
		location: t.location,
		cpu: t.cpu,
		cpu_vendor: t.cpu_vendor,
		cpu_count: t.cpu_count,
		cpu_cores: t.cpu_cores,
		cpu_threads: t.cpu_threads,
		cpu_generation: t.cpu_generation,
		cpu_score: t.cpu_score,
		cpu_multicore_score: t.cpu_multicore_score,
		is_highio: t.is_highio,
		ram_size: t.ram_size,
		is_ecc: t.is_ecc,
		nvme_count: t.nvme_count,
		nvme_drives: parseJsonArray<number>(t.nvme_drives),
		nvme_size: t.nvme_size,
		sata_count: t.sata_count,
		sata_drives: parseJsonArray<number>(t.sata_drives),
		sata_size: t.sata_size,
		hdd_count: t.hdd_count,
		hdd_drives: parseJsonArray<number>(t.hdd_drives),
		hdd_size: t.hdd_size,
		with_inic: t.with_inic,
		with_hwr: t.with_hwr,
		with_gpu: t.with_gpu,
		with_rps: t.with_rps,
		traffic: t.traffic,
		bandwidth: t.bandwidth,
		information: parseJsonArray<string>(t.information),
		seen: t.seen,
		pricing: resolvePricing(rawById.get(t.id), t),
	}));

	return {
		version: SNAPSHOT_VERSION,
		generated_at: generatedAt,
		count: auctions.length,
		auctions,
	};
}
