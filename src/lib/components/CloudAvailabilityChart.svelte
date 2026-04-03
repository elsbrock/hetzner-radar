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
		locations = []
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

	function buildHeatmap(data: AvailabilityDataPoint[]) {
		// Collect unique timestamps and sort chronologically
		const timestampSet = new Set<string>();
		data.forEach((p) => timestampSet.add(p.timestamp));
		const sortedTimestamps = Array.from(timestampSet).sort();

		// Group by entity (server type or location)
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const groups = new Map<number, { label: string; cells: Map<string, boolean> }>();

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
			// If any event in this bucket shows available, mark available
			const existing = group.cells.get(point.timestamp);
			group.cells.set(
				point.timestamp,
				existing === true ? true : point.available || (point.availabilityRate ?? 0) > 0
			);
		});

		// Build rows with forward-fill: gaps carry forward the last known state.
		// Infer initial state from the first event: if the first event is a
		// transition to "unavailable", the server must have been available before
		// the time range (and vice versa).
		heatmapData = Array.from(groups.entries())
			.sort(([, a], [, b]) => a.label.localeCompare(b.label))
			.map(([id, group]) => {
				const firstEvent = sortedTimestamps.find((ts) => group.cells.has(ts));
				let lastKnown = firstEvent ? !group.cells.get(firstEvent)! : false;
				const cells: HeatmapCell[] = sortedTimestamps.map((ts) => {
					if (group.cells.has(ts)) {
						lastKnown = group.cells.get(ts)!;
					}
					return { timestamp: ts, available: lastKnown };
				});
				return { label: group.label, id, cells };
			});

		// Build time labels
		timeLabels = sortedTimestamps.map((ts) => formatTimestamp(ts));
	}

	function formatTimestamp(ts: string): string {
		const d = new Date(ts);
		if (granularity === 'hour') {
			return d.toLocaleString(undefined, { hour: '2-digit', minute: '2-digit' });
		}
		return d.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });
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
			<div class="inline-flex min-w-full flex-col gap-px">
				<!-- Time axis labels (vertical) -->
				<div class="flex gap-px">
					<div class="w-24 shrink-0"></div>
					<div class="flex flex-1 gap-px">
						{#each heatmapData[0].cells as _, colIdx}
							{@const showLabel =
								colIdx === 0 ||
								colIdx === heatmapData[0].cells.length - 1 ||
								colIdx %
									Math.max(1, Math.floor(heatmapData[0].cells.length / 10)) ===
									0}
							<div class="flex flex-1 justify-center">
								{#if showLabel}
									<span
										class="text-[10px] whitespace-nowrap text-gray-500 dark:text-gray-400"
										style="writing-mode: vertical-rl; transform: rotate(180deg);"
										>{timeLabels[colIdx]}</span
									>
								{/if}
							</div>
						{/each}
					</div>
				</div>

				<!-- Data rows -->
				{#each heatmapData as row, rowIdx (row.id)}
					<div class="flex items-center gap-px">
						<div
							class="w-24 shrink-0 truncate pr-2 text-right text-xs text-gray-700 dark:text-gray-300"
							title={row.label}
						>
							{row.label}
						</div>
						<div class="flex flex-1 gap-px">
							{#each row.cells as cell, colIdx}
								{@const dimmed =
									hoveredCell &&
									hoveredCell.row !== rowIdx &&
									hoveredCell.col !== colIdx}
								<div
									class="heatmap-cell flex-1 rounded-sm {getCellColor(cell.available)}"
									class:opacity-40={dimmed}
									role="gridcell"
									tabindex="-1"
									onmouseenter={() =>
										(hoveredCell = { row: rowIdx, col: colIdx })}
									onmouseleave={() => (hoveredCell = null)}
								>
									<Tooltip placement="top" class="z-50 text-xs"
										>{tooltipText(row, colIdx)}</Tooltip
									>
								</div>
							{/each}
						</div>
					</div>
				{/each}

				<!-- Legend -->
				<div
					class="mt-2 flex items-center gap-4 pl-24 text-xs text-gray-600 dark:text-gray-400"
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
		</div>
	{/if}
</div>

<style>
	.heatmap-cell {
		height: 1.25rem;
		transition: opacity 0.1s;
	}
</style>
