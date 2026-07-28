<script lang="ts">
	import { Spinner, Alert } from 'flowbite-svelte';
	import { AngleLeftOutline, AngleRightOutline } from 'flowbite-svelte-icons';
	import {
		Chart,
		CategoryScale,
		TimeScale,
		LinearScale,
		Tooltip,
		type ChartConfiguration,
		type TooltipItem
	} from 'chart.js';
	import 'chartjs-adapter-date-fns';
	import { MatrixController, MatrixElement } from 'chartjs-chart-matrix';
	import { onDestroy } from 'svelte';
	import { bucketAvailability } from '$lib/availability-history';

	Chart.register(MatrixController, MatrixElement, CategoryScale, TimeScale, LinearScale, Tooltip);

	interface AvailabilityDataPoint {
		timestamp: string;
		serverTypeId: number;
		locationId: number;
		serverTypeName: string;
		locationName: string;
		available: boolean;
		availabilityRate?: number;
		/**
		 * Marks the synthetic point carrying the state entering the window — the
		 * last real transition before `startDate`, restamped to `startDate` by the
		 * API. Seeds the step function; never a transition in its own right.
		 */
		seed?: boolean;
	}

	interface Props {
		startDate: Date;
		endDate: Date;
		serverTypeId?: number;
		locationId?: number;
		granularity?: 'hour' | 'day' | 'week';
		/**
		 * Which axis the rows represent. `location` → one row per server type at the
		 * selected location, `serverType` → one row per location for the selected
		 * type, `pair` → a single row for one (server type × location) combination.
		 */
		viewMode: 'location' | 'serverType' | 'pair';
		selectedLocationId?: number;
		selectedServerTypeId?: number;
		serverTypes?: { id: number; name: string }[];
		locations?: { id: number; name: string; city: string }[];
		/** Map of locationId → list of serverTypeIds supported there. */
		supported?: Record<number, number[]>;
		/** Map of locationId → list of serverTypeIds currently available there. */
		availability?: Record<number, number[]>;
		/**
		 * Step the window one interval back (-1) or forward (+1). The caller owns
		 * the date maths; when omitted, no navigation controls render.
		 */
		onNavigate?: (direction: -1 | 1) => void;
		/** Whether stepping further back is within the retained history. */
		canGoBack?: boolean;
		/** False once the window ends at "now" — there is no future to show. */
		canGoForward?: boolean;
	}

	let {
		startDate,
		endDate,
		serverTypeId: _serverTypeId,
		locationId: _locationId,
		// Accepted for caller compatibility but unused — bucketing is derived from
		// the start/end range, not the granularity hint.
		granularity: _granularity = 'hour',
		viewMode,
		selectedLocationId,
		selectedServerTypeId,
		serverTypes = [],
		locations = [],
		supported = {},
		availability = {},
		onNavigate,
		canGoBack = false,
		canGoForward = false
	}: Props = $props();

	let loading = $state(true);
	let error = $state<string | null>(null);

	// One datum per (entity row × time bucket). `v` is the fraction of the bucket
	// the entity was available (0..1), computed by integrating the step function
	// defined by the transition events — not a binary "up at any point" flag.
	// `x` is the bucket *index* (not a timestamp): the matrix uses a linear index
	// axis and derives cell sizes from chartArea, which keeps the layout stable.
	// (A time x-axis with pixel-derived cell widths fed back into the fit and
	// collapsed the y-axis label gutter at wide viewports.)
	interface MatrixDatum {
		x: number; // bucket index 0..nCols-1
		y: string; // entity row label
		v: number; // uptime fraction 0..1
	}

	// In `pair` mode every event belongs to the one and only row, so events are
	// keyed by this sentinel instead of a server-type or location id.
	const PAIR_ROW_ID = -1;

	let rowLabels = $state<string[]>([]);
	let matrixData = $state<MatrixDatum[]>([]);
	let bucketStarts = $state<number[]>([]); // ms, one per column; for tick labels + tooltip

	// Fixed number of columns for every horizon (24h/7d/30d) so the heatmap reads
	// the same regardless of range; bucket size = horizon / BUCKET_COUNT.
	const BUCKET_COUNT = 84;
	const stepMs = $derived((endDate.getTime() - startDate.getTime()) / BUCKET_COUNT);
	const nRows = $derived(rowLabels.length);
	const nCols = $derived(bucketStarts.length);

	let canvasElement: HTMLCanvasElement | null = $state(null);
	let chartInstance: Chart<'matrix'> | null = null;
	let isDarkMode = $state(
		typeof window !== 'undefined' && document.documentElement.classList.contains('dark')
	);

	// A window that ends at (or within a minute of) now is the live one; older
	// windows must not claim to be the "last" anything.
	const isLiveWindow = $derived(endDate.getTime() >= Date.now() - 60_000);

	// Human-readable banner with the absolute range bounds.
	const rangeBanner = $derived.by(() => {
		const days = (endDate.getTime() - startDate.getTime()) / 86_400_000;
		const prefix = isLiveWindow ? 'Last ' : '';
		let label: string;
		if (days >= 25) label = `${prefix}30 days`;
		else if (days >= 5) label = `${prefix}7 days`;
		else label = `${prefix}24 hours`;

		const fmt =
			days >= 5
				? (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' })
				: (d: Date) =>
						d.toLocaleString(undefined, {
							month: 'short',
							day: '2-digit',
							hour: '2-digit',
							minute: '2-digit'
						});

		return `${label} · ${fmt(startDate)} → ${fmt(endDate)}`;
	});

	// Fetch data when parameters change
	$effect(() => {
		if (viewMode === 'location' && !selectedLocationId) return;
		if (viewMode === 'serverType' && !selectedServerTypeId) return;
		if (viewMode === 'pair' && !(selectedLocationId && selectedServerTypeId)) return;
		fetchData();
	});

	async function fetchData() {
		loading = true;
		error = null;

		try {
			// Just the display range: the API returns raw transitions at full
			// resolution plus an explicit `seed` point carrying the state the window
			// opens in, so there is no need to over-fetch history here and infer it.
			// eslint-disable-next-line svelte/prefer-svelte-reactivity
			const params = new URLSearchParams({
				startDate: startDate.toISOString(),
				endDate: endDate.toISOString()
			});

			// `pair` narrows on both axes; the other modes narrow on one and fan the
			// other one out across rows.
			if (viewMode !== 'serverType' && selectedLocationId) {
				params.append('locationId', selectedLocationId.toString());
			}
			if (viewMode !== 'location' && selectedServerTypeId) {
				params.append('serverTypeId', selectedServerTypeId.toString());
			}

			const response = await fetch(`/api/cloud-status/history?${params}`);

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to fetch data');
			}

			const result = await response.json();
			buildMatrix((result.data as AvailabilityDataPoint[]) ?? []);
		} catch (err) {
			console.error('Error fetching availability data:', err);
			error = err instanceof Error ? err.message : 'Failed to load data';
			rowLabels = [];
			matrixData = [];
		} finally {
			loading = false;
		}
	}

	// Analytics Engine returns "YYYY-MM-DD HH:MM:SS" (no TZ, but UTC). Coerce
	// to a Date with explicit Z so bucketing is timezone-stable.
	function parseEventTimestamp(ts: string): number {
		let s = ts;
		if (!s.includes('T')) s = s.replace(' ', 'T');
		if (!s.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(s)) s += 'Z';
		return new Date(s).getTime();
	}

	// BUCKET_COUNT evenly spaced bucket starts spanning the display range. Fixed
	// count → identical column count for every horizon.
	function generateBucketStarts(): number[] {
		const startMs = startDate.getTime();
		const buckets: number[] = [];
		for (let i = 0; i < BUCKET_COUNT; i++) buckets.push(startMs + i * stepMs);
		return buckets;
	}

	// Rows that should appear for the current selection, derived from the
	// supported/availability snapshot (not the event stream) so entities with no
	// transitions in the window still render, seeded with their current state.
	//
	// `snapshotKnown` distinguishes "the snapshot says unavailable" from "the
	// snapshot has nothing to say about this row" — both surface as
	// `currentlyAvailable: false`, but only the former may override chart data.
	interface ExpectedEntity {
		id: number;
		label: string;
		currentlyAvailable: boolean;
		snapshotKnown: boolean;
	}

	function expectedEntities(): ExpectedEntity[] {
		const out: ExpectedEntity[] = [];
		if (
			viewMode === 'pair' &&
			selectedLocationId !== undefined &&
			selectedServerTypeId !== undefined
		) {
			const st = serverTypes.find((s) => s.id === selectedServerTypeId);
			const loc = locations.find((l) => l.id === selectedLocationId);
			out.push({
				id: PAIR_ROW_ID,
				label: `${st?.name ?? `Server ${selectedServerTypeId}`} · ${loc?.city ?? `Location ${selectedLocationId}`}`,
				currentlyAvailable: (availability[selectedLocationId] || []).includes(selectedServerTypeId),
				snapshotKnown: (supported[selectedLocationId] || []).includes(selectedServerTypeId)
			});
		} else if (viewMode === 'location' && selectedLocationId !== undefined) {
			const currentlyAvailable = new Set(availability[selectedLocationId] || []);
			for (const stId of supported[selectedLocationId] || []) {
				const st = serverTypes.find((s) => s.id === stId);
				if (!st) continue;
				out.push({
					id: stId,
					label: st.name,
					currentlyAvailable: currentlyAvailable.has(stId),
					// Enumerated from the supported matrix, so the snapshot covers it.
					snapshotKnown: true
				});
			}
		} else if (viewMode === 'serverType' && selectedServerTypeId !== undefined) {
			for (const loc of locations) {
				if (!(supported[loc.id] || []).includes(selectedServerTypeId)) continue;
				const currentlyAvailable = (availability[loc.id] || []).includes(selectedServerTypeId);
				out.push({ id: loc.id, label: loc.city, currentlyAvailable, snapshotKnown: true });
			}
		}
		return out;
	}

	function buildMatrix(data: AvailabilityDataPoint[]) {
		const starts = generateBucketStarts(); // display buckets over [start, end]
		const seedStart = startDate.getTime();
		const windowEnd = endDate.getTime();

		// Group transition events by entity (server type or location). Seed points
		// are held apart: they state the entry condition rather than a change, so
		// they must not be replayed as transitions.
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const events = new Map<number, { t: number; up: boolean }[]>();
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const seeds = new Map<number, boolean>();
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const labelById = new Map<number, string>();
		for (const point of data) {
			const typeLabel =
				serverTypes.find((s) => s.id === point.serverTypeId)?.name ||
				point.serverTypeName ||
				`Server ${point.serverTypeId}`;
			const cityLabel =
				locations.find((l) => l.id === point.locationId)?.city ||
				point.locationName ||
				`Location ${point.locationId}`;
			const id =
				viewMode === 'pair'
					? PAIR_ROW_ID
					: viewMode === 'location'
						? point.serverTypeId
						: point.locationId;
			if (!labelById.has(id)) {
				const label =
					viewMode === 'pair'
						? `${typeLabel} · ${cityLabel}`
						: viewMode === 'location'
							? typeLabel
							: cityLabel;
				labelById.set(id, label);
			}
			const up = point.available || (point.availabilityRate ?? 0) > 0;
			if (point.seed) {
				// In `pair` mode every point collapses onto PAIR_ROW_ID, and the query
				// is already narrowed to that one pair, so there is exactly one seed.
				seeds.set(id, up);
				continue;
			}
			const t = Math.max(parseEventTimestamp(point.timestamp), seedStart);
			(events.get(id) ?? events.set(id, []).get(id)!).push({ t, up });
		}

		// Union of rows: every expected entity, plus any entity that has events but
		// somehow isn't in the supported snapshot.
		const expected = expectedEntities();
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const rows = new Map<number, { label: string; currentlyAvailable: boolean; snapshotKnown: boolean }>();
		for (const e of expected)
			rows.set(e.id, {
				label: e.label,
				currentlyAvailable: e.currentlyAvailable,
				snapshotKnown: e.snapshotKnown
			});
		for (const [id, label] of labelById) {
			if (!rows.has(id)) rows.set(id, { label, currentlyAvailable: false, snapshotKnown: false });
		}

		const ordered = Array.from(rows.entries()).sort(([, a], [, b]) =>
			a.label.localeCompare(b.label)
		);

		rowLabels = ordered.map(([, r]) => r.label);

		const out: MatrixDatum[] = [];
		for (const [id, row] of ordered) {
			const values = bucketAvailability({
				buckets: starts,
				stepMs,
				seedStart,
				windowEnd,
				// State entering the window, in order of authority: the seed resolved
				// from the last transition before the window; else — meaning the pair
				// has not changed state within the seed lookback — the live snapshot,
				// which is exactly that unchanged state. If neither is known, assume
				// unavailable rather than inventing uptime.
				seed: seeds.get(id) ?? (row.snapshotKnown ? row.currentlyAvailable : false),
				events: events.get(id) ?? [],
				// Only the live window can be checked against the live snapshot; older
				// windows describe the past.
				reconcileTo: isLiveWindow && row.snapshotKnown ? row.currentlyAvailable : null
			});

			for (let i = 0; i < values.length; i++) {
				out.push({ x: i, y: row.label, v: values[i] });
			}
		}
		bucketStarts = starts;
		matrixData = out;
	}

	// Continuous red → amber → green ramp by uptime fraction.
	function colorForFraction(v: number): string {
		const hue = Math.max(0, Math.min(1, v)) * 130; // 0=red, 130=green
		const light = isDarkMode ? 42 : 52;
		return `hsl(${hue}, 65%, ${light}%)`;
	}

	function formatBucket(ms: number): string {
		const horizonDays = (endDate.getTime() - startDate.getTime()) / 86_400_000;
		const d = new Date(ms);
		if (horizonDays <= 2) {
			// 24h: time of day.
			return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
		}
		if (horizonDays <= 10) {
			// 7d: day + time so intra-day buckets are distinguishable.
			return d.toLocaleString(undefined, {
				month: 'short',
				day: '2-digit',
				hour: '2-digit',
				minute: '2-digit'
			});
		}
		// 30d: date only.
		return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
	}

	// Full span of a bucket, not just its start — buckets are sub-day at every
	// range (≈2 h at 7d, ≈8.5 h at 30d), so a lone timestamp is ambiguous.
	function formatBucketRange(startMs: number, endMs: number): string {
		const a = new Date(startMs);
		const b = new Date(endMs);
		const time = (d: Date) =>
			d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
		const day = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' });

		return a.toDateString() === b.toDateString()
			? `${day(a)}, ${time(a)} – ${time(b)}`
			: `${day(a)} ${time(a)} – ${day(b)} ${time(b)}`;
	}

	// Watch for theme changes so canvas colours track light/dark.
	$effect(() => {
		if (typeof window === 'undefined') return;
		isDarkMode = document.documentElement.classList.contains('dark');
		const observer = new MutationObserver(() => {
			isDarkMode = document.documentElement.classList.contains('dark');
		});
		observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
		return () => observer.disconnect();
	});

	// (Re)build the chart whenever data or theme changes.
	$effect(() => {
		if (!canvasElement || matrixData.length === 0) return;
		// Hand Chart.js plain (non-reactive) copies. Chart.js decorates the data
		// points and labels with internal properties; doing that to Svelte's
		// `$state` proxies throws `state_descriptors_fixed`. Snapshotting also
		// touches the reactive deps so the effect re-runs on change.
		const data = $state.snapshot(matrixData) as MatrixDatum[];
		const labels = $state.snapshot(rowLabels) as string[];
		const buckets = $state.snapshot(bucketStarts) as number[];
		const cols = nCols;
		const rows = nRows;
		const dark = isDarkMode;
		// Needed by the tooltip to state each bucket's span, not just its start.
		const step = stepMs;
		const windowEndMs = endDate.getTime();
		// Match the app's other charts (GenericChart) so axes look consistent
		// across light/dark themes.
		const tickColor = dark ? '#F3F4F6' : '#374151';
		const gridColor = dark ? 'rgba(75,85,99,0.2)' : 'rgba(209,213,219,0.3)';

		const config: ChartConfiguration<'matrix'> = {
			type: 'matrix',
			data: {
				datasets: [
					{
						label: 'Availability',
						data: data as unknown as { x: number; y: string }[],
						backgroundColor: (ctx) =>
							colorForFraction((ctx.raw as MatrixDatum | undefined)?.v ?? 0),
						borderWidth: 0,
						// Cell size from chartArea + column/row counts — stable across
						// viewport widths and independent of axis pixel math.
						width: (ctx) => {
							const area = ctx.chart.chartArea;
							return area ? Math.max(1, area.width / Math.max(1, cols) - 1) : 0;
						},
						height: (ctx) => {
							const area = ctx.chart.chartArea;
							return area ? Math.max(1, area.height / Math.max(1, rows) - 1) : 0;
						}
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: false,
				layout: { padding: { right: 4 } },
				scales: {
					x: {
						type: 'linear',
						position: 'top',
						min: -0.5,
						max: cols - 0.5,
						offset: false,
						ticks: {
							color: tickColor,
							minRotation: 45,
							maxRotation: 45,
							autoSkip: true,
							maxTicksLimit: 12,
							stepSize: 1,
							// Linear axis carries bucket indices; render the bucket's date.
							callback: (value) => {
								const i = Math.round(value as number);
								return i >= 0 && i < buckets.length ? formatBucket(buckets[i]) : '';
							}
						},
						grid: { display: false },
						border: { color: gridColor }
					},
					y: {
						type: 'category',
						labels,
						offset: true,
						reverse: true,
						ticks: { color: tickColor, autoSkip: false },
						grid: { display: false },
						border: { color: gridColor }
					}
				},
				plugins: {
					legend: { display: false },
					tooltip: {
						displayColors: false,
						callbacks: {
							title: (items: TooltipItem<'matrix'>[]) => {
								const raw = items[0]?.raw as MatrixDatum | undefined;
								if (!raw) return '';
								const bStart = buckets[raw.x] ?? 0;
								// The final bucket is clipped to the window end.
								const bEnd = Math.min(bStart + step, windowEndMs);
								return `${raw.y} · ${formatBucketRange(bStart, bEnd)}`;
							},
							label: (item: TooltipItem<'matrix'>) => {
								const raw = item.raw as MatrixDatum | undefined;
								return `Available: ${Math.round((raw?.v ?? 0) * 100)}% of the time`;
							}
						}
					}
				}
			}
		};

		if (chartInstance) chartInstance.destroy();
		const ctx = canvasElement.getContext('2d');
		if (ctx) chartInstance = new Chart(ctx, config);
	});

	onDestroy(() => {
		chartInstance?.destroy();
		chartInstance = null;
	});

	// Height grows with the number of rows; bounded so it never collapses.
	const chartHeight = $derived(`${Math.max(160, nRows * 24 + 64)}px`);
</script>

<div class="w-full">
	{#if loading}
		<div class="flex h-64 items-center justify-center">
			<Spinner size="8" />
			<p class="ml-3 text-gray-600 dark:text-gray-300">Loading availability data...</p>
		</div>
	{:else if error}
		<Alert color="red">
			<strong>Error:</strong>
			{error}
		</Alert>
	{:else if matrixData.length === 0}
		<Alert color="yellow">
			No availability data found for the selected time period and filters.
		</Alert>
	{:else}
		<div class="mb-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
			{#if onNavigate}
				<button
					type="button"
					class="rounded-sm px-1.5 py-0.5 enabled:cursor-pointer enabled:hover:bg-gray-100 disabled:opacity-30 dark:enabled:hover:bg-gray-700"
					disabled={!canGoBack}
					aria-label="Previous interval"
					title="Previous interval"
					onclick={() => onNavigate?.(-1)}
				>
					<AngleLeftOutline class="h-3.5 w-3.5" />
				</button>
			{/if}
			<span>{rangeBanner}</span>
			{#if onNavigate}
				<button
					type="button"
					class="rounded-sm px-1.5 py-0.5 enabled:cursor-pointer enabled:hover:bg-gray-100 disabled:opacity-30 dark:enabled:hover:bg-gray-700"
					disabled={!canGoForward}
					aria-label="Next interval"
					title="Next interval"
					onclick={() => onNavigate?.(1)}
				>
					<AngleRightOutline class="h-3.5 w-3.5" />
				</button>
				{#if !isLiveWindow && canGoForward}
					<span class="text-gray-400 dark:text-gray-500">· not live</span>
				{/if}
			{/if}
		</div>
		<div class="relative w-full" style="height: {chartHeight};">
			<canvas bind:this={canvasElement}></canvas>
		</div>

		<!-- Legend: continuous uptime ramp -->
		<div class="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
			<span>Less available</span>
			<div
				class="h-3 w-32 rounded-sm"
				style="background: linear-gradient(to right, hsl(0,65%,52%), hsl(65,65%,52%), hsl(130,65%,52%));"
			></div>
			<span>More available</span>
		</div>
	{/if}
</div>
