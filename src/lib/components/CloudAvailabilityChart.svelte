<script lang="ts">
	import { Spinner, Alert } from 'flowbite-svelte';
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

	Chart.register(MatrixController, MatrixElement, CategoryScale, TimeScale, LinearScale, Tooltip);

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

	let rowLabels = $state<string[]>([]);
	let matrixData = $state<MatrixDatum[]>([]);
	let bucketStarts = $state<number[]>([]); // ms, one per column; for tick labels + tooltip

	const stepMs = $derived(granularity === 'hour' ? 3_600_000 : 86_400_000);
	const nRows = $derived(rowLabels.length);
	const nCols = $derived(bucketStarts.length);

	let canvasElement: HTMLCanvasElement | null = $state(null);
	let chartInstance: Chart<'matrix'> | null = null;
	let isDarkMode = $state(
		typeof window !== 'undefined' && document.documentElement.classList.contains('dark')
	);

	// Human-readable banner with the absolute range bounds.
	const rangeBanner = $derived.by(() => {
		const days = (endDate.getTime() - startDate.getTime()) / 86_400_000;
		let label: string;
		if (days >= 25) label = 'Last 30 days';
		else if (days >= 5) label = 'Last 7 days';
		else label = 'Last 24 hours';

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
		fetchData();
	});

	async function fetchData() {
		loading = true;
		error = null;

		try {
			// Always fetch at hourly resolution, regardless of the display bucket
			// size. The API pre-buckets with MAX(available) at the requested
			// granularity, so requesting 'day' would collapse each day to a single
			// binary value and destroy the sub-day detail we need to shade daily
			// cells by uptime fraction. Hourly transitions are integrated into
			// whatever bucket size we render (see buildMatrix).
			// eslint-disable-next-line svelte/prefer-svelte-reactivity
			const params = new URLSearchParams({
				startDate: startDate.toISOString(),
				endDate: endDate.toISOString(),
				granularity: 'hour'
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

	// Bucket start timestamps (ms), aligned to UTC boundaries, spanning the range.
	// Column count is derived from the time range so static rows still render.
	function generateBucketStarts(): number[] {
		const buckets: number[] = [];
		let cur =
			granularity === 'hour'
				? Date.UTC(
						startDate.getUTCFullYear(),
						startDate.getUTCMonth(),
						startDate.getUTCDate(),
						startDate.getUTCHours()
					)
				: Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate());
		const endMs = endDate.getTime();
		while (cur <= endMs) {
			buckets.push(cur);
			cur += stepMs;
		}
		return buckets;
	}

	// Rows that should appear for the current selection, derived from the
	// supported/availability snapshot (not the event stream) so entities with no
	// transitions in the window still render, seeded with their current state.
	function expectedEntities(): { id: number; label: string; currentlyAvailable: boolean }[] {
		const out: { id: number; label: string; currentlyAvailable: boolean }[] = [];
		if (viewMode === 'location' && selectedLocationId !== undefined) {
			const currentlyAvailable = new Set(availability[selectedLocationId] || []);
			for (const stId of supported[selectedLocationId] || []) {
				const st = serverTypes.find((s) => s.id === stId);
				if (!st) continue;
				out.push({ id: stId, label: st.name, currentlyAvailable: currentlyAvailable.has(stId) });
			}
		} else if (viewMode === 'serverType' && selectedServerTypeId !== undefined) {
			for (const loc of locations) {
				if (!(supported[loc.id] || []).includes(selectedServerTypeId)) continue;
				const currentlyAvailable = (availability[loc.id] || []).includes(selectedServerTypeId);
				out.push({ id: loc.id, label: loc.city, currentlyAvailable });
			}
		}
		return out;
	}

	// Fraction of [a, b) during which `changePoints` is in the available state.
	function availableFraction(
		changePoints: { t: number; up: boolean }[],
		a: number,
		b: number,
		windowEnd: number
	): number {
		if (b <= a) return 0;
		let up = 0;
		for (let i = 0; i < changePoints.length; i++) {
			if (!changePoints[i].up) continue;
			const segStart = changePoints[i].t;
			const segEnd = i + 1 < changePoints.length ? changePoints[i + 1].t : windowEnd;
			up += Math.max(0, Math.min(segEnd, b) - Math.max(segStart, a));
		}
		return up / (b - a);
	}

	function buildMatrix(data: AvailabilityDataPoint[]) {
		const starts = generateBucketStarts();
		const windowStart = starts[0] ?? startDate.getTime();
		const windowEnd = endDate.getTime();

		// Group transition events by entity (server type or location).
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const events = new Map<number, { t: number; up: boolean }[]>();
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const labelById = new Map<number, string>();
		for (const point of data) {
			const id = viewMode === 'location' ? point.serverTypeId : point.locationId;
			if (!labelById.has(id)) {
				const label =
					viewMode === 'location'
						? serverTypes.find((s) => s.id === point.serverTypeId)?.name ||
							point.serverTypeName ||
							`Server ${point.serverTypeId}`
						: locations.find((l) => l.id === point.locationId)?.city ||
							point.locationName ||
							`Location ${point.locationId}`;
				labelById.set(id, label);
			}
			const up = point.available || (point.availabilityRate ?? 0) > 0;
			const t = Math.max(parseEventTimestamp(point.timestamp), windowStart);
			(events.get(id) ?? events.set(id, []).get(id)!).push({ t, up });
		}

		// Union of rows: every expected entity, plus any entity that has events but
		// somehow isn't in the supported snapshot.
		const expected = expectedEntities();
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const rows = new Map<number, { label: string; currentlyAvailable: boolean }>();
		for (const e of expected) rows.set(e.id, { label: e.label, currentlyAvailable: e.currentlyAvailable });
		for (const [id, label] of labelById) {
			if (!rows.has(id)) rows.set(id, { label, currentlyAvailable: false });
		}

		const ordered = Array.from(rows.entries()).sort(([, a], [, b]) =>
			a.label.localeCompare(b.label)
		);

		rowLabels = ordered.map(([, r]) => r.label);

		const out: MatrixDatum[] = [];
		for (const [id, row] of ordered) {
			const evs = (events.get(id) ?? []).slice().sort((p, q) => p.t - q.t);
			// State at the window start: events are transitions, so invert the first
			// one. With no events, fall back to the current snapshot.
			const seed = evs.length > 0 ? !evs[0].up : row.currentlyAvailable;
			const changePoints = [{ t: windowStart, up: seed }, ...evs];

			for (let i = 0; i < starts.length; i++) {
				const bStart = starts[i];
				const bEnd = Math.min(bStart + stepMs, windowEnd);
				out.push({
					x: i,
					y: row.label,
					v: availableFraction(changePoints, bStart, bEnd, windowEnd)
				});
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
		const d = new Date(ms);
		if (granularity === 'hour') {
			return d.toLocaleString(undefined, {
				month: 'short',
				day: '2-digit',
				hour: '2-digit',
				minute: '2-digit'
			});
		}
		return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
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
						min: -0.5,
						max: cols - 0.5,
						offset: false,
						ticks: {
							color: tickColor,
							maxRotation: 0,
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
								return raw ? `${raw.y} · ${formatBucket(buckets[raw.x] ?? 0)}` : '';
							},
							label: (item: TooltipItem<'matrix'>) => {
								const raw = item.raw as MatrixDatum | undefined;
								return `Uptime: ${Math.round((raw?.v ?? 0) * 100)}%`;
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
		<div class="mb-3 text-xs text-gray-500 dark:text-gray-400">{rangeBanner}</div>
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
