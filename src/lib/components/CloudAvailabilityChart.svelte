<script lang="ts">
	import { Spinner, Alert, Tooltip } from 'flowbite-svelte';

	interface AvailabilityDataPoint {
		timestamp: string;
		serverTypeId: number;
		locationId: number;
		serverTypeName: string;
		locationName: string;
		available: boolean;
		availabilityRate?: number;
	}

	interface Props {
		startDate: Date;
		endDate: Date;
		serverTypeId?: number;
		locationId?: number;
		granularity?: 'hour' | 'day' | 'week';
		viewMode: 'location' | 'serverType';
		selectedLocationId?: number;
		selectedServerTypeId?: number;
		serverTypes?: { id: number; name: string }[];
		locations?: { id: number; name: string; city: string }[];
		/** Map of locationId → list of serverTypeIds supported there. */
		supported?: Record<number, number[]>;
		/** Map of locationId → list of serverTypeIds currently available there. */
		availability?: Record<number, number[]>;
	}

	let {
		startDate,
		endDate,
		serverTypeId: _serverTypeId,
		locationId: _locationId,
		granularity = 'hour',
		viewMode,
		selectedLocationId,
		selectedServerTypeId,
		serverTypes = [],
		locations = [],
		supported = {},
		availability = {}
	}: Props = $props();

	let loading = $state(true);
	let error = $state<string | null>(null);

	interface HeatmapCell {
		timestamp: string;
		available: boolean;
	}

	interface HeatmapRow {
		label: string;
		id: number;
		cells: HeatmapCell[];
	}

	let heatmapData = $state<HeatmapRow[]>([]);
	let timeLabels = $state<string[]>([]);
	let hoveredCell = $state<{ row: number; col: number } | null>(null);

	const nCols = $derived(heatmapData[0]?.cells.length ?? 0);

	// Width for labels column based on longest label (in ch units + padding)
	const labelWidth = $derived(
		heatmapData.length > 0
			? `${Math.max(...heatmapData.map((r) => r.label.length)) + 1}ch`
			: '4ch'
	);

	// Grid template — first track is the row-label column, then one minmax(6px,1fr)
	// per data bucket. Using CSS grid (instead of nested flex with flex-1 children)
	// guarantees that header labels and data cells line up exactly, since both rows
	// of the grid resolve to the same column tracks at the same pixel positions.
	const gridTemplate = $derived(
		`${labelWidth} repeat(${nCols}, minmax(6px, 1fr))`
	);

	// Fetch data when parameters change
	$effect(() => {
		if (viewMode === 'location' && !selectedLocationId) return;
		if (viewMode === 'serverType' && !selectedServerTypeId) return;

		fetchData();
	});

	async function fetchData() {
		loading = true;
		error = null;

		try {
			// eslint-disable-next-line svelte/prefer-svelte-reactivity
			const params = new URLSearchParams({
				startDate: startDate.toISOString(),
				endDate: endDate.toISOString(),
				granularity
			});

			if (viewMode === 'location' && selectedLocationId) {
				params.append('locationId', selectedLocationId.toString());
			} else if (viewMode === 'serverType' && selectedServerTypeId) {
				params.append('serverTypeId', selectedServerTypeId.toString());
			}

			const response = await fetch(`/api/cloud-status/history?${params}`);

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to fetch data');
			}

			const result = await response.json();

			if (!result.data || result.data.length === 0) {
				heatmapData = [];
				timeLabels = [];
				return;
			}

			buildHeatmap(result.data);
		} catch (err) {
			console.error('Error fetching availability data:', err);
			error = err instanceof Error ? err.message : 'Failed to load data';
			heatmapData = [];
			timeLabels = [];
		} finally {
			loading = false;
		}
	}

	// Canonical bucket key: ISO-Z string aligned to the bucket's UTC boundary.
	function pad2(n: number): string {
		return String(n).padStart(2, '0');
	}

	function bucketKey(d: Date): string {
		const y = d.getUTCFullYear();
		const mo = pad2(d.getUTCMonth() + 1);
		const da = pad2(d.getUTCDate());
		if (granularity === 'hour') {
			return `${y}-${mo}-${da}T${pad2(d.getUTCHours())}:00:00Z`;
		}
		return `${y}-${mo}-${da}T00:00:00Z`;
	}

	// Analytics Engine returns "YYYY-MM-DD HH:MM:SS" (no TZ, but UTC). Coerce
	// to a Date with explicit Z so further bucketing is timezone-stable.
	function parseEventTimestamp(ts: string): Date {
		let s = ts;
		if (!s.includes('T')) s = s.replace(' ', 'T');
		if (!s.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(s)) s += 'Z';
		return new Date(s);
	}

	// Generate the full set of bucket keys spanning [startDate, endDate], aligned
	// to UTC boundaries. This makes column count deterministic from the time
	// range — independent of whether any availability changes happened — so
	// rows for static (non-transitioning) entities can still be drawn.
	function generateBuckets(): string[] {
		const buckets: string[] = [];
		let cur: Date;
		if (granularity === 'hour') {
			cur = new Date(
				Date.UTC(
					startDate.getUTCFullYear(),
					startDate.getUTCMonth(),
					startDate.getUTCDate(),
					startDate.getUTCHours()
				)
			);
		} else {
			cur = new Date(
				Date.UTC(
					startDate.getUTCFullYear(),
					startDate.getUTCMonth(),
					startDate.getUTCDate()
				)
			);
		}
		const stepMs = granularity === 'hour' ? 3600_000 : 86_400_000;
		const endMs = endDate.getTime();
		while (cur.getTime() <= endMs) {
			buckets.push(bucketKey(cur));
			cur = new Date(cur.getTime() + stepMs);
		}
		return buckets;
	}

	// All entities (server types or locations) that should appear as rows for the
	// current selection — derived from the supported/availability snapshot, not
	// from the event stream. This is what fixes "selecting Falkenstein only
	// shows one server": types with zero transitions in the period now still
	// render, filled with their current state.
	function expectedEntities(): {
		id: number;
		label: string;
		currentlyAvailable: boolean;
	}[] {
		const out: { id: number; label: string; currentlyAvailable: boolean }[] = [];
		if (viewMode === 'location' && selectedLocationId !== undefined) {
			const supportedTypes = supported[selectedLocationId] || [];
			const currentlyAvailable = new Set(availability[selectedLocationId] || []);
			for (const stId of supportedTypes) {
				const st = serverTypes.find((s) => s.id === stId);
				if (!st) continue;
				out.push({
					id: stId,
					label: st.name,
					currentlyAvailable: currentlyAvailable.has(stId)
				});
			}
		} else if (viewMode === 'serverType' && selectedServerTypeId !== undefined) {
			for (const loc of locations) {
				const supportedTypes = supported[loc.id] || [];
				if (!supportedTypes.includes(selectedServerTypeId)) continue;
				const currentlyAvailable = (availability[loc.id] || []).includes(
					selectedServerTypeId
				);
				out.push({
					id: loc.id,
					label: loc.city,
					currentlyAvailable
				});
			}
		}
		return out;
	}

	function buildHeatmap(data: AvailabilityDataPoint[]) {
		const sortedTimestamps = generateBuckets();

		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const groups = new Map<number, { label: string; cells: Map<string, boolean> }>();

		// Ingest events, normalising each to the canonical bucket key so they
		// match keys produced by generateBuckets().
		data.forEach((point) => {
			const key = viewMode === 'location' ? point.serverTypeId : point.locationId;
			if (!groups.has(key)) {
				let label: string;
				if (viewMode === 'location') {
					const st = serverTypes.find((s) => s.id === point.serverTypeId);
					label = st?.name || point.serverTypeName || `Server ${point.serverTypeId}`;
				} else {
					const loc = locations.find((l) => l.id === point.locationId);
					label = loc?.city || point.locationName || `Location ${point.locationId}`;
				}
				groups.set(key, { label, cells: new Map() });
			}
			const group = groups.get(key)!;
			const ck = bucketKey(parseEventTimestamp(point.timestamp));
			const existing = group.cells.get(ck);
			// If any event in this bucket shows available, mark available.
			group.cells.set(
				ck,
				existing === true ? true : point.available || (point.availabilityRate ?? 0) > 0
			);
		});

		// Seed empty rows for every entity that should appear, even if it had no
		// events in the range.
		const expected = expectedEntities();
		const expectedById = new Map(expected.map((e) => [e.id, e]));
		for (const ent of expected) {
			if (!groups.has(ent.id)) {
				groups.set(ent.id, { label: ent.label, cells: new Map() });
			}
		}

		// Build rows with forward-fill: gaps carry forward the last known state.
		// For rows with events, infer the pre-first-event state by inverting the
		// first event (events represent state transitions). For rows with no
		// events, fill with the current snapshot — that's the most truthful
		// "we have no evidence of a change" guess.
		heatmapData = Array.from(groups.entries())
			.sort(([, a], [, b]) => a.label.localeCompare(b.label))
			.map(([id, group]) => {
				const firstEvent = sortedTimestamps.find((ts) => group.cells.has(ts));
				let lastKnown: boolean;
				if (firstEvent) {
					lastKnown = !group.cells.get(firstEvent)!;
				} else {
					lastKnown = expectedById.get(id)?.currentlyAvailable ?? false;
				}
				const cells: HeatmapCell[] = sortedTimestamps.map((ts) => {
					if (group.cells.has(ts)) {
						lastKnown = group.cells.get(ts)!;
					}
					return { timestamp: ts, available: lastKnown };
				});
				return { label: group.label, id, cells };
			});

		// Build time labels (used in tooltips)
		timeLabels = sortedTimestamps.map((ts) => formatTimestamp(ts));
	}

	function formatTimestamp(ts: string): string {
		const d = new Date(ts);
		if (granularity === 'hour') {
			return d.toLocaleString(undefined, {
				month: 'short',
				day: '2-digit',
				hour: '2-digit',
				minute: '2-digit'
			});
		}
		return d.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });
	}

	// Decide whether the bucket at index `colIdx` should display a date/time label.
	// Buckets are 1h/1d aligned on UTC boundaries by the query (toStartOfInterval).
	// We anchor on the user's local fields so the axis labels read "midnight" /
	// "00:00" in the same timezone the cell tooltips use — keeping label position
	// and label content consistent with what the user sees on hover.
	function isLabelBucket(colIdx: number): boolean {
		if (nCols === 0) return false;
		// Always anchor first/last so the axis has clear endpoints.
		if (colIdx === 0 || colIdx === nCols - 1) return true;

		const ts = heatmapData[0]?.cells[colIdx]?.timestamp;
		if (!ts) return false;
		const d = new Date(ts);

		if (granularity === 'hour') {
			// Wide ranges (e.g. 7d/168 buckets): label only at local midnight (~7).
			// Narrow ranges (e.g. 24h): label every 6 local hours (~4).
			if (nCols > 48) return d.getHours() === 0;
			return d.getHours() % 6 === 0;
		}
		if (granularity === 'day') {
			// Long ranges: every 5th bucket. Short ranges: every bucket.
			if (nCols > 14) return colIdx % 5 === 0;
			return true;
		}
		return false;
	}

	function formatAxisLabel(colIdx: number): string {
		const ts = heatmapData[0]?.cells[colIdx]?.timestamp;
		if (!ts) return '';
		const d = new Date(ts);
		if (granularity === 'hour') {
			// Multi-day hourly view: every label is a date (positioned at local
			// midnight, plus pinned endpoints) — keeps the axis visually uniform.
			// 24h view: every label is a time of day.
			if (nCols > 48) {
				return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
			}
			return d.toLocaleTimeString(undefined, {
				hour: '2-digit',
				minute: '2-digit',
				hour12: false
			});
		}
		return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
	}

	function getCellColor(available: boolean): string {
		return available ? 'bg-green-500 dark:bg-green-600' : 'bg-red-400 dark:bg-red-500';
	}

	function tooltipText(row: HeatmapRow, colIdx: number): string {
		const cell = row.cells[colIdx];
		if (!cell) return '';
		const status = cell.available ? 'Available' : 'Unavailable';
		return `${row.label}\n${timeLabels[colIdx]}\n${status}`;
	}
</script>

<div class="w-full">
	{#if loading}
		<div class="flex h-64 items-center justify-center">
			<Spinner size="8" />
			<p class="ml-3 text-gray-600 dark:text-gray-300">Loading availability data...</p>
		</div>
	{:else if error}
		<Alert color="red">
			<strong>Error:</strong> {error}
		</Alert>
	{:else if heatmapData.length === 0}
		<Alert color="yellow">
			No availability data found for the selected time period and filters.
		</Alert>
	{:else}
		<div class="overflow-x-auto">
			<div
				class="grid gap-px"
				style="grid-template-columns: {gridTemplate};"
			>
				<!-- Header corner spacer -->
				<div></div>

				<!-- Time axis labels — one grid cell per data column so labels and
				     cells share the exact same column tracks. -->
				{#each heatmapData[0].cells as _, colIdx (colIdx)}
					<div class="time-label-cell flex h-16 items-end justify-center">
						{#if isLabelBucket(colIdx)}
							<span
								class="text-[10px] leading-none whitespace-nowrap text-gray-500 dark:text-gray-400"
								style="writing-mode: vertical-rl; transform: rotate(180deg);"
								>{formatAxisLabel(colIdx)}</span
							>
						{/if}
					</div>
				{/each}

				<!-- Data rows -->
				{#each heatmapData as row, rowIdx (row.id)}
					<div
						class="flex items-center justify-end overflow-hidden pr-2 text-xs text-gray-700 dark:text-gray-300"
						title={row.label}
					>
						<span class="truncate">{row.label}</span>
					</div>
					{#each row.cells as cell, colIdx (colIdx)}
						{@const dimmed =
							hoveredCell &&
							hoveredCell.row !== rowIdx &&
							hoveredCell.col !== colIdx}
						<div
							class="heatmap-cell rounded-sm {getCellColor(cell.available)}"
							class:opacity-40={dimmed}
							role="gridcell"
							tabindex="-1"
							onmouseenter={() => (hoveredCell = { row: rowIdx, col: colIdx })}
							onmouseleave={() => (hoveredCell = null)}
						>
							<Tooltip placement="top" class="z-50 text-xs"
								>{tooltipText(row, colIdx)}</Tooltip
							>
						</div>
					{/each}
				{/each}
			</div>

			<!-- Legend -->
			<div
				class="mt-3 flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400"
				style="padding-left: calc({labelWidth} + 0.25rem);"
			>
				<div class="flex items-center gap-1">
					<div class="h-3 w-3 rounded-sm bg-green-500 dark:bg-green-600"></div>
					Available
				</div>
				<div class="flex items-center gap-1">
					<div class="h-3 w-3 rounded-sm bg-red-400 dark:bg-red-500"></div>
					Unavailable
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.heatmap-cell {
		height: 1.25rem;
		transition: opacity 0.1s;
	}
</style>
