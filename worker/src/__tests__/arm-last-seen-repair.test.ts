/**
 * Tests for the one-off ARM `lastSeenAvailable` repair.
 */

import { describe, it, expect } from 'vitest';
import { ARM_SUSPECT_SINCE, findSuspectKeys, recoverLastSeen, repairLastSeen, type RecoveryEvent } from '../arm-last-seen-repair';
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
