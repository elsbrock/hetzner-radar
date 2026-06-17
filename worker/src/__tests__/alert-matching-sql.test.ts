/**
 * Executes the real MATCH_ALERTS_SQL against an in-memory SQLite database
 * (node:sqlite — D1 is SQLite-compatible) and asserts actual match / no-match
 * outcomes for every dimension of the alert filter.
 *
 * Why this exists: the older alert-service tests only assert the SQL *string*
 * (e.g. `toContain('ssdNvmeCount')`), which passes even when the matching math is
 * wrong. These tests run the query, so they catch logic regressions and drift
 * from the frontend matcher (src/lib/api/frontend/filter.ts generateFilterQuery).
 *
 * Regression anchors for reported bugs:
 *   - NVMe "min 3.5 TB/disk" fired at ~1.9 TB/disk (250 vs 500 GB/unit)
 *   - HDD "≥ 39 TB total" fired on a 2×512 GB SSD box (no total mode + count gate)
 *   - city-prefix datacenter alerts (FSN/NBG/HEL) never fired (exact IN vs LIKE)
 */

import { DatabaseSync } from 'node:sqlite';
import { describe, it, expect, beforeEach } from 'vitest';
import { AlertService } from '../alert-service';

// Pull the exact production query off an instance (private field; cast to read it).
const MATCH_ALERTS_SQL = (
	new AlertService({ db: {} as never, notificationService: {} as never, doId: 'test' }) as unknown as {
		MATCH_ALERTS_SQL: string;
	}
).MATCH_ALERTS_SQL;

// Mirrors src/lib/filter.ts defaultFilter — a fully permissive filter.
const defaultFilter = {
	version: 1,
	recentlySeen: true,
	locationGermany: true,
	locationFinland: true,
	showAuction: true,
	showStandard: false,
	cpuCount: 1,
	cpuIntel: true,
	cpuAMD: true,
	cpuCores: [0, 128],
	cpuThreads: [0, 256],
	ramInternalSize: [4, 10],
	ssdNvmeCount: [0, 8],
	ssdNvmeInternalSize: [0, 18],
	ssdSataCount: [0, 4],
	ssdSataInternalSize: [0, 14],
	hddCount: [0, 15],
	hddInternalSize: [4, 44],
	ssdNvmeSizeMode: 'per-disk',
	ssdSataSizeMode: 'per-disk',
	hddSizeMode: 'per-disk',
	diskMode: 'and',
	selectedDatacenters: [] as string[],
	selectedCpuModels: [] as string[],
	extrasECC: null as boolean | null,
	extrasINIC: null as boolean | null,
	extrasHWR: null as boolean | null,
	extrasGPU: null as boolean | null,
	extrasRPS: null as boolean | null,
};

type Filter = typeof defaultFilter & Record<string, unknown>;

interface ServerSpec {
	price?: number;
	location?: string;
	datacenter?: string;
	cpu?: string;
	cpu_vendor?: string;
	cpu_count?: number;
	cpu_cores?: number | null;
	cpu_threads?: number | null;
	ram_size?: number;
	is_ecc?: number;
	with_inic?: number;
	with_hwr?: number;
	with_gpu?: number;
	with_rps?: number;
	nvme?: number[];
	sata?: number[];
	hdd?: number[];
}

interface AlertOpts {
	price?: number;
	vat_rate?: number;
	includes_ipv4_cost?: boolean;
}

let db: DatabaseSync;

beforeEach(() => {
	db = new DatabaseSync(':memory:');
	db.exec(`
		CREATE TABLE current_auctions (
			id INTEGER PRIMARY KEY,
			price REAL, location TEXT, datacenter TEXT,
			cpu TEXT, cpu_vendor TEXT, cpu_count INTEGER, cpu_cores INTEGER, cpu_threads INTEGER,
			ram_size INTEGER, is_ecc INTEGER, with_inic INTEGER, with_hwr INTEGER, with_gpu INTEGER, with_rps INTEGER,
			nvme_count INTEGER, nvme_size INTEGER, nvme_drives TEXT,
			sata_count INTEGER, sata_size INTEGER, sata_drives TEXT,
			hdd_count INTEGER, hdd_size INTEGER, hdd_drives TEXT,
			seen TEXT
		);
		CREATE TABLE price_alert (
			id INTEGER PRIMARY KEY,
			name TEXT, filter TEXT, price REAL, vat_rate REAL, user_id TEXT,
			includes_ipv4_cost INTEGER, email_notifications INTEGER, discord_notifications INTEGER, created_at TEXT
		);
		CREATE TABLE user (id TEXT PRIMARY KEY, email TEXT, discord_webhook_url TEXT);
		INSERT INTO user (id, email, discord_webhook_url) VALUES ('u1', 'u@example.com', NULL);
	`);
});

function insertServer(spec: ServerSpec): void {
	const nvme = spec.nvme ?? [];
	const sata = spec.sata ?? [];
	const hdd = spec.hdd ?? [];
	const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);
	db.prepare(
		`INSERT INTO current_auctions (
			id, price, location, datacenter, cpu, cpu_vendor, cpu_count, cpu_cores, cpu_threads,
			ram_size, is_ecc, with_inic, with_hwr, with_gpu, with_rps,
			nvme_count, nvme_size, nvme_drives, sata_count, sata_size, sata_drives,
			hdd_count, hdd_size, hdd_drives, seen
		) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '2026-06-17T00:00:00Z')`,
	).run(
		spec.price ?? 100,
		spec.location ?? 'Germany',
		spec.datacenter ?? 'FSN1-DC14',
		spec.cpu ?? 'AMD Ryzen 9 5950X',
		spec.cpu_vendor ?? 'AMD',
		spec.cpu_count ?? 1,
		spec.cpu_cores ?? null,
		spec.cpu_threads ?? null,
		spec.ram_size ?? 64,
		spec.is_ecc ?? 0,
		spec.with_inic ?? 0,
		spec.with_hwr ?? 0,
		spec.with_gpu ?? 0,
		spec.with_rps ?? 0,
		nvme.length,
		sum(nvme),
		JSON.stringify(nvme),
		sata.length,
		sum(sata),
		JSON.stringify(sata),
		hdd.length,
		sum(hdd),
		JSON.stringify(hdd),
	);
}

function insertAlert(filter: Partial<Filter>, opts: AlertOpts = {}): void {
	const full = { ...defaultFilter, ...filter };
	db.prepare(
		`INSERT INTO price_alert (id, name, filter, price, vat_rate, user_id, includes_ipv4_cost, email_notifications, discord_notifications, created_at)
		 VALUES (1, 'test', ?, ?, ?, 'u1', ?, 1, 0, '2026-01-01T00:00:00Z')`,
	).run(JSON.stringify(full), opts.price ?? 100000, opts.vat_rate ?? 0, opts.includes_ipv4_cost ? 1 : 0);
}

/** True if the single alert matches the single server under MATCH_ALERTS_SQL. */
function matches(filter: Partial<Filter>, server: ServerSpec, opts: AlertOpts = {}): boolean {
	db.exec('DELETE FROM price_alert; DELETE FROM current_auctions;');
	insertAlert(filter, opts);
	insertServer(server);
	return db.prepare(MATCH_ALERTS_SQL).all().length > 0;
}

describe('MATCH_ALERTS_SQL', () => {
	it('default (permissive) filter matches a basic server', () => {
		expect(matches({}, {})).toBe(true);
	});

	describe('price / VAT / IPv4', () => {
		it('matches when target >= net price', () => {
			expect(matches({}, { price: 100 }, { price: 100 })).toBe(true);
		});
		it('does not match when target is below price', () => {
			expect(matches({}, { price: 100 }, { price: 99 })).toBe(false);
		});
		it('applies VAT to the auction price', () => {
			expect(matches({}, { price: 100 }, { price: 100, vat_rate: 19 })).toBe(false); // 100 < 119
			expect(matches({}, { price: 100 }, { price: 120, vat_rate: 19 })).toBe(true); // 120 >= 119
		});
		it('adds the IPv4 cost when includes_ipv4_cost is set', () => {
			expect(matches({}, { price: 99 }, { price: 100, includes_ipv4_cost: true })).toBe(false); // 100 < 100.19
			expect(matches({}, { price: 99 }, { price: 101, includes_ipv4_cost: true })).toBe(true);
		});
	});

	describe('location', () => {
		it('Germany-only filter excludes Finland servers', () => {
			const f = { locationGermany: true, locationFinland: false };
			expect(matches(f, { location: 'Germany' })).toBe(true);
			expect(matches(f, { location: 'Finland' })).toBe(false);
		});
		it('Finland-only filter excludes Germany servers', () => {
			const f = { locationGermany: false, locationFinland: true };
			expect(matches(f, { location: 'Finland' })).toBe(true);
			expect(matches(f, { location: 'Germany' })).toBe(false);
		});
		it('neither location selected matches nothing', () => {
			expect(matches({ locationGermany: false, locationFinland: false }, { location: 'Germany' })).toBe(false);
		});
	});

	describe('CPU vendor', () => {
		it('Intel-only filter excludes AMD', () => {
			const f = { cpuIntel: true, cpuAMD: false };
			expect(matches(f, { cpu_vendor: 'Intel' })).toBe(true);
			expect(matches(f, { cpu_vendor: 'AMD' })).toBe(false);
		});
	});

	describe('CPU count', () => {
		it('requires cpu_count >= filter.cpuCount', () => {
			expect(matches({ cpuCount: 2 }, { cpu_count: 1 })).toBe(false);
			expect(matches({ cpuCount: 2 }, { cpu_count: 2 })).toBe(true);
			expect(matches({ cpuCount: 2 }, { cpu_count: 4 })).toBe(true);
		});
	});

	describe('RAM (log2 scale)', () => {
		// ramInternalSize [5,6] => 32 GB .. 64 GB
		const f = { ramInternalSize: [5, 6] };
		it('matches within range', () => {
			expect(matches(f, { ram_size: 32 })).toBe(true);
			expect(matches(f, { ram_size: 64 })).toBe(true);
		});
		it('excludes outside range', () => {
			expect(matches(f, { ram_size: 16 })).toBe(false);
			expect(matches(f, { ram_size: 128 })).toBe(false);
		});
	});

	describe('datacenters', () => {
		it('empty selection matches any datacenter', () => {
			expect(matches({ selectedDatacenters: [] }, { datacenter: 'NBG1-DC3' })).toBe(true);
		});
		it('specific datacenter matches exactly', () => {
			const f = { selectedDatacenters: ['FSN1-DC14'] };
			expect(matches(f, { datacenter: 'FSN1-DC14' })).toBe(true);
			expect(matches(f, { datacenter: 'NBG1-DC3' })).toBe(false);
		});
		it('city prefix matches all datacenters in that city (regression)', () => {
			expect(matches({ selectedDatacenters: ['FSN'] }, { datacenter: 'FSN1-DC14' })).toBe(true);
			expect(matches({ selectedDatacenters: ['FSN'] }, { datacenter: 'NBG1-DC3' })).toBe(false);
			expect(matches({ selectedDatacenters: ['HEL'] }, { datacenter: 'HEL1-DC5' })).toBe(true);
		});
		it('mixed specific + prefix selection', () => {
			const f = { selectedDatacenters: ['NBG', 'HEL1-DC5'] };
			expect(matches(f, { datacenter: 'NBG1-DC1' })).toBe(true);
			expect(matches(f, { datacenter: 'HEL1-DC5' })).toBe(true);
			expect(matches(f, { datacenter: 'FSN1-DC14' })).toBe(false);
		});
	});

	describe('CPU models', () => {
		it('empty selection matches any CPU', () => {
			expect(matches({ selectedCpuModels: [] }, { cpu: 'Intel Xeon E3' })).toBe(true);
		});
		it('restricts to listed models', () => {
			const f = { selectedCpuModels: ['AMD Ryzen 9 5950X'] };
			expect(matches(f, { cpu: 'AMD Ryzen 9 5950X' })).toBe(true);
			expect(matches(f, { cpu: 'Intel Xeon E3' })).toBe(false);
		});
	});

	describe('extras', () => {
		it('ECC: true requires is_ecc, false requires non-ECC, null ignores', () => {
			expect(matches({ extrasECC: true }, { is_ecc: 1 })).toBe(true);
			expect(matches({ extrasECC: true }, { is_ecc: 0 })).toBe(false);
			expect(matches({ extrasECC: false }, { is_ecc: 0 })).toBe(true);
			expect(matches({ extrasECC: false }, { is_ecc: 1 })).toBe(false);
			expect(matches({ extrasECC: null }, { is_ecc: 1 })).toBe(true);
		});
		it('GPU / iNIC / HWR / RPS flags are matched when set', () => {
			expect(matches({ extrasGPU: true }, { with_gpu: 1 })).toBe(true);
			expect(matches({ extrasGPU: true }, { with_gpu: 0 })).toBe(false);
			expect(matches({ extrasINIC: true }, { with_inic: 0 })).toBe(false);
			expect(matches({ extrasHWR: true }, { with_hwr: 1 })).toBe(true);
			expect(matches({ extrasRPS: false }, { with_rps: 1 })).toBe(false);
		});
	});

	describe('CPU cores / threads', () => {
		it('cores: within range matches, outside does not, null is ignored', () => {
			const f = { cpuCores: [4, 8] };
			expect(matches(f, { cpu_cores: 6 })).toBe(true);
			expect(matches(f, { cpu_cores: 2 })).toBe(false);
			expect(matches(f, { cpu_cores: 10 })).toBe(false);
			expect(matches(f, { cpu_cores: null })).toBe(true); // unknown cores -> not excluded
		});
		it('threads: within range matches, outside does not', () => {
			const f = { cpuThreads: [8, 16] };
			expect(matches(f, { cpu_threads: 12 })).toBe(true);
			expect(matches(f, { cpu_threads: 4 })).toBe(false);
		});
	});

	describe('disk size — NVMe per-disk uses 500 GB/unit (Bug #1)', () => {
		// slider [7,18] per-disk => 3.5 TB .. 9 TB per disk
		const f: Partial<Filter> = {
			ssdNvmeCount: [2, 4],
			ssdNvmeInternalSize: [7, 18],
			ssdNvmeSizeMode: 'per-disk',
			ssdSataCount: [0, 0],
			ssdSataInternalSize: [0, 0],
			hddCount: [0, 0],
			hddInternalSize: [0, 0],
		};
		it('does NOT match 2×1.92 TB NVMe (below 3.5 TB/disk)', () => {
			expect(matches(f, { nvme: [1920, 1920] })).toBe(false);
		});
		it('matches 2×4 TB NVMe (within 3.5–9 TB/disk)', () => {
			expect(matches(f, { nvme: [4000, 4000] })).toBe(true);
		});
		it('matches exactly at the 3.5 TB/disk lower bound, not below', () => {
			expect(matches(f, { nvme: [3500, 3500] })).toBe(true);
			expect(matches(f, { nvme: [3499, 3499] })).toBe(false);
		});
		it('does NOT match when a disallowed SATA disk is present', () => {
			expect(matches(f, { nvme: [4000, 4000], sata: [512] })).toBe(false);
		});
	});

	describe('disk size — HDD total mode (Bug #2)', () => {
		// slider [78,660] total => 39 TB .. 330 TB total HDD; count at default
		const f: Partial<Filter> = { hddInternalSize: [78, 660], hddSizeMode: 'total' };
		it('does NOT match a 2×512 GB SSD server (no HDD)', () => {
			expect(matches(f, { sata: [512, 512] })).toBe(false);
		});
		it('matches a server with ≥ 39 TB total HDD', () => {
			expect(matches(f, { hdd: Array(10).fill(4000) })).toBe(true);
		});
		it('does NOT match a single 4 TB HDD (below 39 TB total)', () => {
			expect(matches(f, { hdd: [4000] })).toBe(false);
		});
	});

	describe('disk combination modes', () => {
		it('AND mode requires every constrained disk type', () => {
			const f: Partial<Filter> = { ssdNvmeCount: [1, 4], ssdNvmeInternalSize: [2, 8], hddCount: [1, 8], hddInternalSize: [4, 44] };
			expect(matches(f, { nvme: [2000, 2000], hdd: [4000, 4000] })).toBe(true);
			expect(matches(f, { nvme: [2000, 2000] })).toBe(false); // missing HDD
		});
		it('OR mode matches when any constrained type qualifies', () => {
			const f: Partial<Filter> = {
				diskMode: 'or',
				ssdNvmeCount: [1, 4],
				ssdNvmeInternalSize: [2, 8],
				hddCount: [1, 8],
				hddInternalSize: [10, 44],
			};
			expect(matches(f, { nvme: [2000, 2000] })).toBe(true); // NVMe leg qualifies; HDD leg absent
		});
		it('count-only filter (no size narrowing) still matches', () => {
			expect(matches({ ssdNvmeCount: [2, 2] }, { nvme: [1000, 1000] })).toBe(true);
			expect(matches({ ssdNvmeCount: [2, 2] }, { nvme: [1000, 1000, 1000] })).toBe(false);
		});
	});

	describe('backward compatibility', () => {
		it('alert without sizeMode/diskMode keys is treated as per-disk / and', () => {
			const f = { ...defaultFilter, ssdNvmeCount: [1, 4], ssdNvmeInternalSize: [2, 8] } as Record<string, unknown>;
			delete f.ssdNvmeSizeMode;
			delete f.diskMode;
			insertAlert(f as Partial<Filter>);
			insertServer({ nvme: [2000, 2000] });
			expect(db.prepare(MATCH_ALERTS_SQL).all().length).toBeGreaterThan(0);
		});
	});
});
