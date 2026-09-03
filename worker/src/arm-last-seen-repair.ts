/**
 * One-off repair of `lastSeenAvailable` after the deprecated availability field.
 *
 * Until #288 the poller read availability from `datacenter.server_types.
 * available`, which Hetzner deprecated on 2026-04-01 along with the guarantee
 * that it stays accurate. It drifted, and from 2026-08-17 09:27:31 it reported
 * all four CAX (ARM) types as available in fsn1/nbg1/hel1 while they could not
 * be created (see `ARM_SUSPECT_SINCE` for how that instant is established).
 * Every poll in that window stamped `lastSeenAvailable` with "now", overwriting
 * the true timestamps — for most pairs, a date in May 2026.
 *
 * Fixing the source does not undo that: the stored matrix keeps the bogus
 * timestamps, so the status table reads "last seen: minutes ago" for pairs that
 * have not been available in months. This module rewrites those entries from
 * Analytics Engine, which still holds the genuine transitions.
 *
 * It is deliberately narrow: it touches only ARM pairs, only entries stamped
 * inside the suspect window, and runs once.
 *
 * ---
 *
 * THIS MODULE IS DEAD CODE ONCE IT HAS RUN IN PRODUCTION.
 *
 * It repairs a fixed, historical corruption. The instant the storage flag
 * `armLastSeenRepairV1` is set on the live Durable Object, every subsequent
 * call is a no-op, and this file plus `CloudAvailabilityDO.repairArmLastSeen`
 * and its call in `alarm()` can be deleted outright.
 *
 * Confirm from the worker log — `wrangler tail` — which reports either
 * "Repaired N ARM last-seen entries" on the run that does the work, or
 * "ARM last-seen repair: already-done" on every alarm after it. (The `/debug`
 * route also lists the storage keys, but the worker sets `workers_dev: false`
 * with no routes, so it is not reachable in production.)
 *
 * Nothing enforces that, so it is stated here rather than left to be inferred.
 */

import type { AvailabilityMatrix, LastSeenMatrix, ServerTypeInfo } from './cloud-status-service';

/** Storage key recording that the repair has already run. */
export const ARM_LAST_SEEN_REPAIR_FLAG = 'armLastSeenRepairV1';

/**
 * When the deprecated field started claiming ARM availability.
 *
 * Hetzner does not document this, but the transition record pins it. All twelve
 * ARM pairs flipped available at 2026-08-17 09:27:31, and twenty-one minutes
 * earlier, at 09:06:25, the same field reported cax11 in fsn1 and nbg1
 * *unavailable*. It could not have been asserting ARM availability before a
 * moment when it was still denying it, so the fiction begins at 09:27:31.
 *
 * That also means the cax11 availability of 2026-08-13 → 2026-08-17 09:06 is
 * genuine and must be preserved: it arrived in two locations an hour apart,
 * which is stock moving, not a data source changing. An earlier cutoff would
 * rewrite those two pairs from 2026-08-17 back to May and lose a real window.
 *
 * Do not widen this to catch more: the window is five days, and many x86 types
 * legitimately flap inside it. The ARM restriction in `findSuspectKeys` is what
 * keeps those from being "repaired" to an earlier date — verified 2026-08-22,
 * twice, when the deprecated and current endpoints disagreed on exactly the
 * twelve ARM pairs out of 114 compared.
 */
export const ARM_SUSPECT_SINCE = '2026-08-17T09:27:00.000Z';

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
 * Dropping is a choice between two wrong answers, not a retreat to a right one.
 * A missing entry renders as a grey "Never" — identical to ash and hil, where
 * ARM has genuinely never been offered — so fsn1/nbg1/hel1 will claim ARM was
 * never available there, when it was, in May. That is still preferable to
 * asserting it was available minutes ago, which is both false and the specific
 * complaint in #287, but it is not a neutral outcome and should not be
 * described as one. Representing "unknown" as its own state would be better,
 * and needs a UI decision this repair should not make.
 *
 * Either way the cell self-corrects the moment the pair is next in stock:
 * `updateLastSeenTimestamps` stamps every available pair on every poll. This
 * repair is worth the remaining duration of the outage, no more.
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

/**
 * The subset of `DurableObjectStorage` the repair needs, so it can be driven by
 * a test double rather than a live Durable Object.
 */
export interface RepairStorage {
	get<T>(key: string): Promise<T | undefined>;
	put(key: string, value: unknown): Promise<void>;
}

export interface RepairDeps {
	storage: RepairStorage;
	/** Transitions for one server type across every location, within retention. */
	queryHistory(serverTypeId: number): Promise<RecoveryEvent[]>;
}

export type RepairOutcome =
	/** The flag is set; the repair has already run. */
	| { status: 'already-done' }
	/** Nothing has been polled yet, so there is no matrix to repair. */
	| { status: 'no-snapshot' }
	/**
	 * No identifiable suspect entries. Deliberately does *not* set the flag:
	 * before the endpoint migration lands, the poller still reports the affected
	 * pairs as available and nothing is selectable, so recording "done" here
	 * would retire the repair without it ever running.
	 */
	| { status: 'nothing-to-repair' }
	| { status: 'repaired'; suspect: number; recovered: number; cleared: number };

/**
 * Run the one-off repair, at most once.
 *
 * Throws on a query or storage failure, leaving the flag unset and the stored
 * matrix untouched, so the next alarm retries. A wrong timestamp is
 * recoverable; a half-written matrix is not.
 */
export async function runArmLastSeenRepair({ storage, queryHistory }: RepairDeps): Promise<RepairOutcome> {
	if (await storage.get<boolean>(ARM_LAST_SEEN_REPAIR_FLAG)) return { status: 'already-done' };

	const [lastSeen, serverTypes, availability] = await Promise.all([
		storage.get<LastSeenMatrix>('lastSeenAvailable'),
		storage.get<ServerTypeInfo[]>('serverTypes'),
		storage.get<AvailabilityMatrix>('availability'),
	]);

	if (!lastSeen || !serverTypes || !availability) return { status: 'no-snapshot' };

	const suspectKeys = findSuspectKeys(lastSeen, serverTypes, availability);
	if (suspectKeys.length === 0) return { status: 'nothing-to-repair' };

	// One query per ARM type covers every location it is offered in — four round
	// trips rather than one per pair. Issued together; they are independent.
	const armTypeIds = [...new Set(suspectKeys.map((key) => Number(key.slice(key.indexOf('-') + 1))))];
	const histories = await Promise.all(armTypeIds.map((id) => queryHistory(id)));

	const recovered = recoverLastSeen(histories.flat());
	await storage.put('lastSeenAvailable', repairLastSeen({ lastSeen, suspectKeys, recovered }));
	await storage.put(ARM_LAST_SEEN_REPAIR_FLAG, true);

	const recoveredCount = suspectKeys.filter((key) => recovered[key]).length;
	return {
		status: 'repaired',
		suspect: suspectKeys.length,
		recovered: recoveredCount,
		cleared: suspectKeys.length - recoveredCount,
	};
}
