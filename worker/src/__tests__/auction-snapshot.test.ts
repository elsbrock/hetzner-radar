/**
 * Tests for the MCP auction snapshot builder.
 *
 * Pricing is the part worth pinning down: it is the field an LLM will quote at
 * a user, and it is assembled from two sources (the transformer drops the
 * pricing extras, so they come from the raw feed).
 */

import { describe, it, expect } from 'vitest';
import { buildSnapshot, SNAPSHOT_VERSION } from '../auction-snapshot';
import type { HetznerAuctionServer } from '../hetzner-auction-client';
import type { RawServerData } from '../auction-data-transformer';
import { mockHetznerAuctionServer, mockRawServerData } from './fixtures/auction-data';

const GENERATED_AT = '2026-07-25T12:00:00.000Z';

/** Mirrors the live feed: ip_price is an object, not a scalar. */
function rawWithPricing(overrides: Partial<HetznerAuctionServer> = {}): HetznerAuctionServer {
	return {
		...mockHetznerAuctionServer,
		ip_price: { Monthly: 1.7, Hourly: 0.0027, Amount: 1 },
		setup_price: 0,
		hourly_price: 0.0865,
		next_reduce_timestamp: 1785224615,
		...overrides,
	};
}

function transformed(overrides: Partial<RawServerData> = {}): RawServerData {
	return { ...mockRawServerData, price: 54, fixed_price: false, ...overrides };
}

describe('buildSnapshot', () => {
	it('stamps version, count and generation time', () => {
		const snapshot = buildSnapshot([transformed()], [rawWithPricing()], GENERATED_AT);

		expect(snapshot.version).toBe(SNAPSHOT_VERSION);
		expect(snapshot.count).toBe(1);
		expect(snapshot.generated_at).toBe(GENERATED_AT);
		expect(snapshot.auctions).toHaveLength(1);
	});

	it('reads ipv4 cost from the nested ip_price object', () => {
		const { pricing } = buildSnapshot([transformed()], [rawWithPricing()], GENERATED_AT).auctions[0];

		expect(pricing.ipv4_monthly).toBe(1.7);
		expect(pricing.monthly_net).toBe(54);
		expect(pricing.total_monthly_net).toBe(55.7);
	});

	it('states net-ness explicitly so a model cannot assume VAT is included', () => {
		const { pricing } = buildSnapshot([transformed()], [rawWithPricing()], GENERATED_AT).auctions[0];

		expect(pricing.vat_included).toBe(false);
		expect(pricing.currency).toBe('EUR');
	});

	it('avoids floating point drift in the total', () => {
		const { pricing } = buildSnapshot([transformed({ price: 38.1 })], [rawWithPricing()], GENERATED_AT).auctions[0];

		// 38.1 + 1.7 is 39.800000000000004 in IEEE 754.
		expect(pricing.total_monthly_net).toBe(39.8);
	});

	it('converts next_reduce_timestamp from unix seconds to ISO', () => {
		const { pricing } = buildSnapshot([transformed()], [rawWithPricing()], GENERATED_AT).auctions[0];

		expect(pricing.next_reduce_at).toBe(new Date(1785224615 * 1000).toISOString());
	});

	it('reports no price reduction for fixed-price servers', () => {
		const { pricing } = buildSnapshot([transformed({ fixed_price: true })], [rawWithPricing()], GENERATED_AT).auctions[0];

		expect(pricing.fixed_price).toBe(true);
		expect(pricing.next_reduce_at).toBeNull();
	});

	it('falls back to the known ipv4 rate when the feed omits ip_price', () => {
		const raw = rawWithPricing();
		delete raw.ip_price;

		const { pricing } = buildSnapshot([transformed()], [raw], GENERATED_AT).auctions[0];

		expect(pricing.ipv4_monthly).toBe(1.7);
	});

	it('still emits an auction when the raw record is missing entirely', () => {
		const snapshot = buildSnapshot([transformed()], [], GENERATED_AT);

		expect(snapshot.auctions).toHaveLength(1);
		expect(snapshot.auctions[0].pricing.ipv4_monthly).toBe(1.7);
		expect(snapshot.auctions[0].pricing.setup_net).toBe(0);
	});

	it('parses JSON-encoded drive and information arrays back into arrays', () => {
		const auction = buildSnapshot([transformed()], [rawWithPricing()], GENERATED_AT).auctions[0];

		expect(Array.isArray(auction.nvme_drives)).toBe(true);
		expect(Array.isArray(auction.sata_drives)).toBe(true);
		expect(Array.isArray(auction.hdd_drives)).toBe(true);
		expect(auction.information).toEqual(['Special feature', 'Additional info']);
	});

	it('tolerates malformed JSON in array columns rather than throwing', () => {
		const auction = buildSnapshot([transformed({ nvme_drives: 'not json', information: null })], [rawWithPricing()], GENERATED_AT)
			.auctions[0];

		expect(auction.nvme_drives).toEqual([]);
		expect(auction.information).toEqual([]);
	});

	it('matches raw records to transformed ones by id, not by position', () => {
		const snapshot = buildSnapshot(
			[transformed({ id: 1, price: 10 }), transformed({ id: 2, price: 20 })],
			[rawWithPricing({ id: 2, setup_price: 99 }), rawWithPricing({ id: 1, setup_price: 5 })],
			GENERATED_AT,
		);

		expect(snapshot.auctions.find((a) => a.id === 1)?.pricing.setup_net).toBe(5);
		expect(snapshot.auctions.find((a) => a.id === 2)?.pricing.setup_net).toBe(99);
	});
});
