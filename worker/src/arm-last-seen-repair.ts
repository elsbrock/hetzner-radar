/**
 * One-off repair of `lastSeenAvailable` after the deprecated availability field.
 *
 * Until #288 the poller read availability from `datacenter.server_types.
 * available`, which Hetzner deprecated on 2026-04-01 along with the guarantee
 * that it stays accurate. It drifted, and from 2026-08-13 it reported the CAX
 * (ARM) types as available in fsn1/nbg1/hel1 while they could not be created.
 * Every poll in that window stamped `lastSeenAvailable` with "now", overwriting
 * the true timestamps — for most pairs, a date in May 2026.
 *
 * Fixing the source does not undo that: the stored matrix keeps the bogus
 * timestamps, so the status table reads "last seen: minutes ago" for pairs that
 * have not been available in months. This module rewrites those entries from
 * Analytics Engine, which still holds the genuine transitions.
 *
 * It is deliberately narrow and self-deleting: it touches only ARM pairs, only
 * entries stamped inside the suspect window, and runs once. Delete this module
 * (and its call site) once it has run in production.
 */

import type { AvailabilityMatrix, LastSeenMatrix, ServerTypeInfo } from './cloud-status-service';

/** Storage key recording that the repair has already run. */
export const ARM_LAST_SEEN_REPAIR_FLAG = 'armLastSeenRepairV1';

/**
 * When the deprecated field started claiming ARM availability.
 *
 * Inferred, not documented: it is the earliest ARM `available` transition in
 * the suspect run (cax11 in fsn1/nbg1, 2026-08-13). Nothing before it is
 * touched, so an over-wide guess costs accuracy only for genuinely stale
 * entries, never for correct ones.
 */
export const ARM_SUSPECT_SINCE = '2026-08-13T00:00:00.000Z';

export interface RepairInput {
	/** The stored matrix, keyed `"locationId-serverTypeId"`. */
	lastSeen: LastSeenMatrix;
	/** Keys whose stored timestamp came from the deprecated field. */
	suspectKeys: string[];
	/**
	 * Last genuine availability per suspect key, recovered from Analytics
	 * Engine. A key missing here has no answer inside AE's three-month
	 * retention.
	 */
	recovered: Record<string, string>;
}

/**
 * Replace each suspect entry with its recovered timestamp, or drop it.
 *
 * Dropping is deliberate. The UI renders a missing entry as "Never", which is
 * imprecise but honest about not knowing; leaving the bogus value in place
 * asserts the pair was available minutes ago, which is simply false and is the
 * thing being complained about.
 */
export function repairLastSeen({ lastSeen, suspectKeys, recovered }: RepairInput): LastSeenMatrix {
	const repaired = { ...lastSeen };

	for (const key of suspectKeys) {
		const trueLastSeen = recovered[key];
		if (trueLastSeen) {
			repaired[key] = trueLastSeen;
		} else {
			delete repaired[key];
		}
	}

	return repaired;
}

/**
 * Entries that the deprecated field is responsible for: an ARM pair, stamped
 * inside the suspect window, that the authoritative endpoint now reports as
 * unavailable.
 *
 * The last condition matters — a pair that really is available right now has a
 * correct timestamp whatever wrote it, and must be left alone.
 */
export function findSuspectKeys(
	lastSeen: LastSeenMatrix,
	serverTypes: ServerTypeInfo[],
	availability: AvailabilityMatrix,
	suspectSince: string = ARM_SUSPECT_SINCE,
): string[] {
	const armIds = new Set(serverTypes.filter((st) => st.architecture === 'arm').map((st) => st.id));
	const threshold = Date.parse(suspectSince);
	const suspect: string[] = [];

	for (const [key, timestamp] of Object.entries(lastSeen)) {
		const separator = key.indexOf('-');
		const locationId = Number(key.slice(0, separator));
		const serverTypeId = Number(key.slice(separator + 1));

		if (!armIds.has(serverTypeId)) continue;
		if (!(Date.parse(timestamp) >= threshold)) continue;
		if ((availability[locationId] ?? []).includes(serverTypeId)) continue;

		suspect.push(key);
	}

	return suspect;
}

/** A transition as returned by the history query. */
export interface RecoveryEvent {
	timestamp: string;
	serverTypeId: number;
	locationId: number;
	available: boolean;
	seed?: boolean;
}

/**
 * The last moment each pair was genuinely available, read off the transitions
 * that predate the suspect window.
 *
 * A pair drops out of availability at its `unavailable` transition, so that
 * timestamp is when it was last seen — accurate to one poll interval. Events at
 * or after `suspectSince` are ignored: they are the bogus run itself, plus the
 * single corrective `unavailable` the poller writes once #288 deploys.
 */
export function recoverLastSeen(events: RecoveryEvent[], suspectSince: string = ARM_SUSPECT_SINCE): Record<string, string> {
	const threshold = Date.parse(suspectSince);
	const recovered: Record<string, string> = {};

	for (const event of events) {
		if (event.seed) continue;
		if (event.available) continue;

		const at = parseEventTimestamp(event.timestamp);
		if (at >= threshold) continue;

		const key = `${event.locationId}-${event.serverTypeId}`;
		const known = recovered[key];
		if (!known || parseEventTimestamp(known) < at) {
			recovered[key] = new Date(at).toISOString();
		}
	}

	return recovered;
}

/**
 * Analytics Engine returns `"YYYY-MM-DD HH:MM:SS"` — UTC, but without a zone
 * designator, which `Date.parse` would otherwise read as local time.
 */
function parseEventTimestamp(timestamp: string): number {
	let normalized = timestamp;
	if (!normalized.includes('T')) normalized = normalized.replace(' ', 'T');
	if (!normalized.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(normalized)) normalized += 'Z';
	return Date.parse(normalized);
}
