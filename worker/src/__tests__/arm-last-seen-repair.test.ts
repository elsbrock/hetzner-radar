/**
 * Tests for the one-off ARM `lastSeenAvailable` repair.
 */

import { describe, it, expect } from 'vitest';
import {
	ARM_LAST_SEEN_REPAIR_FLAG,
	ARM_SUSPECT_SINCE,
	findSuspectKeys,
	recoverLastSeen,
	repairLastSeen,
	runArmLastSeenRepair,
	type RecoveryEvent,
} from '../arm-last-seen-repair';
import { createMockDurableObjectStorage } from './fixtures/database-mocks';
import type { AvailabilityMatrix, LastSeenMatrix, ServerTypeInfo } from '../cloud-status-service';

function serverType(id: number, name: string, architecture: string): ServerTypeInfo {
	return {
		id,
		name,
		description: name.toUpperCase(),
		cores: 4,
		memory: 8,
		disk: 80,
		cpu_type: 'shared',
		architecture,
		category: 'cost_optimized',
		storageType: 'local',
		isDeprecated: false,
		deprecated: false,
	};
}

const SERVER_TYPES = [serverType(93, 'cax21', 'arm'), serverType(95, 'cax41', 'arm'), serverType(22, 'cx22', 'x86')];

describe('findSuspectKeys', () => {
	const availability: AvailabilityMatrix = { 1: [22], 2: [] };

	it('should select ARM entries stamped inside the suspect window', () => {
		const lastSeen: LastSeenMatrix = {
			'1-93': '2026-08-22T10:00:00.000Z',
			'2-95': '2026-08-20T10:00:00.000Z',
		};

		expect(findSuspectKeys(lastSeen, SERVER_TYPES, availability).sort()).toEqual(['1-93', '2-95']);
	});

	it('should leave entries that predate the suspect window alone', () => {
		const lastSeen: LastSeenMatrix = { '1-93': '2026-05-26T13:26:33.000Z' };

		expect(findSuspectKeys(lastSeen, SERVER_TYPES, availability)).toEqual([]);
	});

	it('should ignore x86 types, which the deprecated field reported correctly', () => {
		const lastSeen: LastSeenMatrix = { '1-22': '2026-08-22T10:00:00.000Z' };

		expect(findSuspectKeys(lastSeen, SERVER_TYPES, availability)).toEqual([]);
	});

	it('should leave a pair that is genuinely available now alone', () => {
		// Its timestamp is "now" and correct, whatever wrote it.
		const lastSeen: LastSeenMatrix = { '1-93': '2026-08-22T10:00:00.000Z' };

		expect(findSuspectKeys(lastSeen, SERVER_TYPES, { 1: [93] })).toEqual([]);
	});
});

describe('recoverLastSeen', () => {
	const events: RecoveryEvent[] = [
		{ timestamp: ARM_SUSPECT_SINCE, serverTypeId: 93, locationId: 1, available: false, seed: true },
		{ timestamp: '2026-05-24 13:07:03', serverTypeId: 93, locationId: 1, available: true },
		{ timestamp: '2026-05-24 13:26:10', serverTypeId: 93, locationId: 1, available: false },
		{ timestamp: '2026-05-26 12:58:20', serverTypeId: 93, locationId: 1, available: true },
		{ timestamp: '2026-05-26 13:26:33', serverTypeId: 93, locationId: 1, available: false },
		{ timestamp: '2026-08-17 09:27:31', serverTypeId: 93, locationId: 1, available: true },
	];

	it('should take the last unavailable transition before the suspect window', () => {
		expect(recoverLastSeen(events)).toEqual({ '1-93': '2026-05-26T13:26:33.000Z' });
	});

	it('should ignore the bogus run and the corrective transition after it', () => {
		const withCorrection: RecoveryEvent[] = [
			...events,
			{ timestamp: '2026-08-22 11:00:00', serverTypeId: 93, locationId: 1, available: false },
		];

		// Not 2026-08-22: that is the poller recording the fix, not real availability.
		expect(recoverLastSeen(withCorrection)).toEqual({ '1-93': '2026-05-26T13:26:33.000Z' });
	});

	it('should return nothing for a pair whose last change predates retention', () => {
		expect(recoverLastSeen([{ timestamp: '2026-08-17 09:27:31', serverTypeId: 94, locationId: 3, available: true }])).toEqual({});
	});

	it('should treat Analytics Engine timestamps as UTC', () => {
		const recovered = recoverLastSeen([{ timestamp: '2026-05-26 13:26:33', serverTypeId: 93, locationId: 1, available: false }]);

		expect(recovered['1-93']).toBe('2026-05-26T13:26:33.000Z');
	});
});

describe('repairLastSeen', () => {
	it('should replace a suspect entry with its recovered timestamp', () => {
		const repaired = repairLastSeen({
			lastSeen: { '1-93': '2026-08-22T10:00:00.000Z', '1-22': '2026-08-22T10:00:00.000Z' },
			suspectKeys: ['1-93'],
			recovered: { '1-93': '2026-05-26T13:26:33.000Z' },
		});

		expect(repaired).toEqual({
			'1-93': '2026-05-26T13:26:33.000Z',
			'1-22': '2026-08-22T10:00:00.000Z',
		});
	});

	it('should drop a suspect entry that could not be recovered', () => {
		// "Never" is imprecise; "minutes ago" is false. Prefer the imprecise one.
		const repaired = repairLastSeen({
			lastSeen: { '3-94': '2026-08-22T10:00:00.000Z' },
			suspectKeys: ['3-94'],
			recovered: {},
		});

		expect(repaired).toEqual({});
	});

	it('should not mutate the stored matrix', () => {
		const lastSeen: LastSeenMatrix = { '1-93': '2026-08-22T10:00:00.000Z' };
		repairLastSeen({ lastSeen, suspectKeys: ['1-93'], recovered: {} });

		expect(lastSeen).toEqual({ '1-93': '2026-08-22T10:00:00.000Z' });
	});
});

describe('recoverLastSeen, cax11 in the days before the cutoff', () => {
	// cax11 was genuinely available 2026-08-13 → 2026-08-17 09:06, then the
	// deprecated field started asserting availability at 09:27. The real end of
	// that window is the answer; an earlier cutoff would rewrite it back to May.
	const events: RecoveryEvent[] = [
		{ timestamp: '2026-05-26 13:26:33', serverTypeId: 45, locationId: 1, available: false },
		{ timestamp: '2026-08-13 09:27:44', serverTypeId: 45, locationId: 1, available: true },
		{ timestamp: '2026-08-17 09:06:25', serverTypeId: 45, locationId: 1, available: false },
		{ timestamp: '2026-08-17 09:27:31', serverTypeId: 45, locationId: 1, available: true },
	];

	it('should keep the genuine availability window that ended just before it', () => {
		expect(recoverLastSeen(events)).toEqual({ '1-45': '2026-08-17T09:06:25.000Z' });
	});
});

describe('runArmLastSeenRepair', () => {
	const serverTypes = SERVER_TYPES;
	const availability: AvailabilityMatrix = { 1: [22] };
	const corruptedLastSeen: LastSeenMatrix = {
		'1-93': '2026-08-20T10:00:00.000Z',
		'1-95': '2026-08-20T10:00:00.000Z',
		'1-22': '2026-08-20T10:00:00.000Z',
	};

	function deps(initial: Record<string, unknown>, history: Record<number, RecoveryEvent[]> = {}) {
		const storage = createMockDurableObjectStorage(initial);
		const queried: number[] = [];
		return {
			storage,
			queried,
			deps: {
				storage,
				queryHistory: async (serverTypeId: number) => {
					queried.push(serverTypeId);
					return history[serverTypeId] ?? [];
				},
			},
		};
	}

	it('should repair suspect entries and record itself as done', async () => {
		const { storage, deps: d } = deps(
			{ lastSeenAvailable: corruptedLastSeen, serverTypes, availability },
			{ 93: [{ timestamp: '2026-05-26 13:26:33', serverTypeId: 93, locationId: 1, available: false }] },
		);

		const outcome = await runArmLastSeenRepair(d);

		expect(outcome).toEqual({ status: 'repaired', suspect: 2, recovered: 1, cleared: 1 });
		expect(await storage.get('lastSeenAvailable')).toEqual({
			'1-93': '2026-05-26T13:26:33.000Z', // recovered
			'1-22': '2026-08-20T10:00:00.000Z', // x86, untouched
			// '1-95' cleared: nothing within retention
		});
		expect(await storage.get(ARM_LAST_SEEN_REPAIR_FLAG)).toBe(true);
	});

	it('should do nothing once the flag is set', async () => {
		const { queried, deps: d } = deps({
			[ARM_LAST_SEEN_REPAIR_FLAG]: true,
			lastSeenAvailable: corruptedLastSeen,
			serverTypes,
			availability,
		});

		expect(await runArmLastSeenRepair(d)).toEqual({ status: 'already-done' });
		expect(queried).toEqual([]);
	});

	it('should not flag itself done when nothing is selectable yet', async () => {
		// Before the endpoint migration lands the poller still reports ARM
		// available, so nothing is suspect. Flagging here would retire the repair
		// without it ever running.
		const { storage, deps: d } = deps({
			lastSeenAvailable: corruptedLastSeen,
			serverTypes,
			availability: { 1: [22, 93, 95] },
		});

		expect(await runArmLastSeenRepair(d)).toEqual({ status: 'nothing-to-repair' });
		expect(await storage.get(ARM_LAST_SEEN_REPAIR_FLAG)).toBeUndefined();
	});

	it('should wait for a snapshot rather than repairing an empty matrix', async () => {
		const { storage, deps: d } = deps({});

		expect(await runArmLastSeenRepair(d)).toEqual({ status: 'no-snapshot' });
		expect(await storage.get(ARM_LAST_SEEN_REPAIR_FLAG)).toBeUndefined();
	});

	it('should leave the matrix and the flag untouched when a query fails', async () => {
		const storage = createMockDurableObjectStorage({ lastSeenAvailable: corruptedLastSeen, serverTypes, availability });

		await expect(
			runArmLastSeenRepair({
				storage,
				queryHistory: async () => {
					throw new Error('Analytics Engine unavailable');
				},
			}),
		).rejects.toThrow('Analytics Engine unavailable');

		expect(await storage.get('lastSeenAvailable')).toEqual(corruptedLastSeen);
		expect(await storage.get(ARM_LAST_SEEN_REPAIR_FLAG)).toBeUndefined();
	});

	it('should query once per ARM type, not once per pair', async () => {
		const { queried, deps: d } = deps({
			lastSeenAvailable: {
				'1-93': '2026-08-20T10:00:00.000Z',
				'2-93': '2026-08-20T10:00:00.000Z',
				'3-93': '2026-08-20T10:00:00.000Z',
			},
			serverTypes,
			availability: { 1: [], 2: [], 3: [] },
		});

		await runArmLastSeenRepair(d);

		expect(queried).toEqual([93]);
	});
});
