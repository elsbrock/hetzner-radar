<script lang="ts">
	import { browser } from '$app/environment';
	import { replaceState } from '$app/navigation';
	import { withDbConnections } from '$lib/api/frontend/dbapi';
	import {
		getDiskPriceStats,
		getMinPriceStats,
		getObservedDays,
		getPriceIndexStats,
		getRamPriceStats,
		getVolumeByCPUModelStats,
		getVolumeByCPUVendorStats,
		getVolumeByCountryDatacenters,
		getVolumeStats,
		getSoldAuctionPriceStats,
		type TemporalStat
	} from '$lib/api/frontend/stats';
	import {
		alignSeries,
		buildDayGrid,
		movingAverage,
		type TemporalPoint
	} from '$lib/chartSeries';
	import GenericChart from '$lib/components/GenericChart.svelte';
	import PageHero from '$lib/components/PageHero.svelte';
	import QuickStat from '$lib/components/QuickStat.svelte';
	import StatCard from '$lib/components/StatCard.svelte';
	import type { AsyncDuckDB } from '@duckdb/duckdb-wasm';
	import {
		faArrowDown,
		faArrowUp,
		faChartLine,
		faHdd,
		faMemory,
		faServer
	} from '@fortawesome/free-solid-svg-icons';
	import { db, initializeDB } from '../../stores/db';
	import { currencySymbol, currentCurrency } from '$lib/stores/settings';
	import { convertPrice } from '$lib/currency';
	import { onMount } from 'svelte';

	onMount(() => {
		// Adopt a linked section before anything mounts its charts.
		const requested = new URLSearchParams(window.location.search).get('tab');
		if (isTabId(requested)) activeTab = requested;

		initializeDB();
	});

	/* ---------------------------------------------------------------- tabs */

	const TABS = [
		{ id: 'index', label: 'Price index', blurb: 'Is the market cheap right now?' },
		{ id: 'prices', label: 'Prices', blurb: 'What a GB of RAM or a TB of disk costs' },
		{ id: 'volume', label: 'Volume', blurb: 'How many servers are listed, and where' },
		{ id: 'cpu', label: 'CPU models', blurb: 'Which chips show up in the auction' }
	] as const;

	type TabId = (typeof TABS)[number]['id'];

	function isTabId(value: string | null): value is TabId {
		return TABS.some((tab) => tab.id === value);
	}

	// The tab is local state, not derived from the URL: routing the click through
	// the router made the panel wait on a navigation before it could repaint. The
	// URL is written afterwards, purely so a section stays linkable and survives a
	// reload, with replaceState so tabbing around does not fill up history.
	let activeTab = $state<TabId>('index');

	function selectTab(tab: TabId) {
		activeTab = tab;
		if (!browser) return;
		const url = new URL(window.location.href);
		if (tab === 'index') {
			url.searchParams.delete('tab');
		} else {
			url.searchParams.set('tab', tab);
		}
		replaceState(url.pathname + url.search, {});
	}

	/** Smoothing overlay on the price charts. Noisy daily minima are the norm. */
	let showAverage = $state(true);
	const AVERAGE_WINDOW = 7;

	/* ---------------------------------------------------------------- data */

	let observedDays = $state<number[]>([]);
	let dailyPriceIndexStats = $state<TemporalStat[]>([]);
	let ramWithECCPriceStats = $state<TemporalStat[]>([]);
	let ramWithoutECCPriceStats = $state<TemporalStat[]>([]);
	let hddPriceStats = $state<TemporalStat[]>([]);
	let nvmePriceStats = $state<TemporalStat[]>([]);
	let sataPriceStats = $state<TemporalStat[]>([]);
	let volumeFinlandStats = $state<TemporalStat[]>([]);
	let volumeGermanyStats = $state<TemporalStat[]>([]);
	let volumeAMDStats = $state<TemporalStat[]>([]);
	let volumeIntelStats = $state<TemporalStat[]>([]);
	let soldAuctionPriceStats = $state<TemporalStat[]>([]);
	let minPriceStats = $state<TemporalStat[]>([]);

	// CPU model volume stats
	let intelCPUModelStats = $state<{ [model: string]: TemporalStat[] }>({});
	let amdCPUModelStats = $state<{ [model: string]: TemporalStat[] }>({});

	// Datacenter volume stats by country
	let finlandDatacenters = $state<string[]>([]);
	let germanyDatacenters = $state<string[]>([]);
	let datacenterVolumeFinlandStats = $state<{ [datacenter: string]: TemporalStat[] }>({});
	let datacenterVolumeGermanyStats = $state<{ [datacenter: string]: TemporalStat[] }>({});

	/* ------------------------------------------------------------- series */

	// Every series is put on the same daily grid so a day nobody has data for
	// renders as a break rather than a straight line across the hole.
	let grid = $derived(buildDayGrid(observedDays));

	/**
	 * A price metric: the raw daily series, plus its moving average on top when
	 * smoothing is on. Both take the same palette slot so the pair reads as one
	 * metric; the raw line recedes so the average is what you see first.
	 */
	function priceSeries(name: string, stats: TemporalStat[], colorIndex: number) {
		const raw = alignSeries(stats, grid, 'gap');
		if (!showAverage) {
			return [{ name, data: raw, colorIndex, width: 2 }];
		}
		return [
			{ name, data: raw, colorIndex, alpha: 0.35, width: 1 },
			{
				name: `${name} · ${AVERAGE_WINDOW}d avg`,
				data: movingAverage(raw, AVERAGE_WINDOW),
				colorIndex,
				width: 2.5,
				tension: 0.25
			}
		];
	}

	/** A volume metric: a missing day on a day we observed is a real zero. */
	function volumeSeries(name: string, stats: TemporalStat[], colorIndex?: number) {
		return { name, data: alignSeries(stats, grid, 'zero'), colorIndex, fill: true };
	}

	let priceIndexSeries = $derived(priceSeries('Price index', dailyPriceIndexStats, 0));
	let ramSeries = $derived([
		...priceSeries('With ECC', ramWithECCPriceStats, 0),
		...priceSeries('Without ECC', ramWithoutECCPriceStats, 1)
	]);
	let hddSeries = $derived(priceSeries('HDD', hddPriceStats, 0));
	let ssdSeries = $derived([
		...priceSeries('NVMe', nvmePriceStats, 0),
		...priceSeries('SATA', sataPriceStats, 1)
	]);
	let soldSeries = $derived(priceSeries('Avg. sold price', soldAuctionPriceStats, 0));

	let countryVolumeSeries = $derived([
		volumeSeries('Finland', volumeFinlandStats),
		volumeSeries('Germany', volumeGermanyStats)
	]);
	let vendorVolumeSeries = $derived([
		volumeSeries('AMD', volumeAMDStats),
		volumeSeries('Intel', volumeIntelStats)
	]);
	// Colour by position in the full sorted datacenter list, so a datacenter keeps
	// its colour no matter what else is on screen.
	let finlandDatacenterSeries = $derived(
		finlandDatacenters.map((dc, i) => volumeSeries(dc, datacenterVolumeFinlandStats[dc] ?? [], i))
	);
	let germanyDatacenterSeries = $derived(
		germanyDatacenters.map((dc, i) => volumeSeries(dc, datacenterVolumeGermanyStats[dc] ?? [], i))
	);
	let intelModelSeries = $derived(
		Object.entries(intelCPUModelStats).map(([model, stats], i) => volumeSeries(model, stats, i))
	);
	let amdModelSeries = $derived(
		Object.entries(amdCPUModelStats).map(([model, stats], i) => volumeSeries(model, stats, i))
	);

	/* -------------------------------------------------------- quick stats */

	/** Last day the series actually has a value for. */
	function latest(points: TemporalPoint[]): number | null {
		for (let i = points.length - 1; i >= 0; i--) {
			if (points[i].y !== null) return points[i].y;
		}
		return null;
	}

	let priceIndexPoints = $derived(alignSeries(dailyPriceIndexStats, grid, 'gap'));
	let currentPriceIndex = $derived(latest(priceIndexPoints));

	let priceIndexTrend = $derived.by(() => {
		// Compare smoothed values, not two raw days: a single outlier at either
		// end used to be enough to flip the arrow.
		const points = movingAverage(priceIndexPoints, AVERAGE_WINDOW).filter((p) => p.y !== null);
		if (points.length < 2) return null;

		const current = points[points.length - 1];
		const thirtyDaysAgoTs = current.x - 30 * 86400;
		// Find the data point closest to 30 days ago
		const closest = points.reduce((prev, curr) =>
			Math.abs(curr.x - thirtyDaysAgoTs) < Math.abs(prev.x - thirtyDaysAgoTs) ? curr : prev
		);
		// Only use if within 3 days of target
		if (Math.abs(closest.x - thirtyDaysAgoTs) > 3 * 86400) return null;
		return closest.y === 0 ? null : ((current.y! - closest.y!) / closest.y!) * 100;
	});

	let isPriceRising = $derived(priceIndexTrend !== null && priceIndexTrend > 0);

	let lastECCPrice = $derived(latest(alignSeries(ramWithECCPriceStats, grid, 'gap')));
	let lastNonECCPrice = $derived(latest(alignSeries(ramWithoutECCPriceStats, grid, 'gap')));
	let lastNvmePrice = $derived(latest(alignSeries(nvmePriceStats, grid, 'gap')));
	let lastHddPrice = $derived(latest(alignSeries(hddPriceStats, grid, 'gap')));

	// 1. Lowest current server price, straight from min(price) over every
	// listing — not min(cheapest AMD, cheapest Intel), which drops the tail of
	// listings whose cpu_vendor is neither ("Intel®", "2x").
	let lowestServerPrice = $derived(latest(alignSeries(minPriceStats, grid, 'gap')));

	// 2. Best RAM value on offer.
	//
	// Absolute, not an ECC-vs-non-ECC delta: ECC machines carry far more RAM, so
	// that comparison measured RAM size and reported ECC as the cheaper option
	// under a tile labelled "ECC Premium".
	let bestRamPricePerGB = $derived(
		lastECCPrice !== null && lastNonECCPrice !== null
			? Math.min(lastECCPrice, lastNonECCPrice)
			: (lastECCPrice ?? lastNonECCPrice)
	);

	// 3. Storage price comparison (NVMe vs HDD)
	let nvmeHddRatio = $derived(
		lastNvmePrice !== null && lastHddPrice !== null && lastHddPrice !== 0
			? (lastNvmePrice / lastHddPrice).toFixed(1)
			: null
	);

	/* ------------------------------------------------------------ options */

	const countAxis = {
		scales: {
			y: {
				stacked: true,
				title: { display: true, text: 'Available servers' },
				ticks: {
					callback: (tickValue: number | string) =>
						typeof tickValue === 'number' ? tickValue.toFixed(0) : tickValue
				}
			},
			x: { stacked: true }
		},
		plugins: { tooltip: { mode: 'index' as const } }
	};

	const manySeriesLegend = {
		...countAxis,
		plugins: {
			...countAxis.plugins,
			legend: {
				align: 'start' as const,
				labels: { boxWidth: 15, padding: 10, font: { size: 11 } },
				maxHeight: 250,
				display: true
			}
		}
	};

	const indexAxis = {
		scales: {
			y: {
				title: { display: true, text: 'Index' },
				ticks: {
					callback: (tickValue: number | string) =>
						typeof tickValue === 'number' ? tickValue.toFixed(3) : tickValue
				}
			}
		}
	};

	/** Prices are stored and charted in EUR net, whatever the display currency. */
	function euroAxis(unit: string, decimals = 2) {
		return {
			scales: {
				y: {
					title: { display: true, text: `€ / ${unit}` },
					ticks: {
						callback: (tickValue: number | string) =>
							typeof tickValue === 'number' ? tickValue.toFixed(decimals) : tickValue
					}
				}
			}
		};
	}

	/* -------------------------------------------------------------- fetch */

	async function fetchData(db: AsyncDuckDB) {
		await withDbConnections(db, async (conn1, conn2, conn3, conn4, conn5) => {
			try {
				// The observed-day grid gates every series, so it lands first and on
				// its own — nothing should render against a half-built calendar.
				observedDays = await getObservedDays(conn1);

				// Everything after that streams in independently: each chart appears
				// as soon as its own query returns, rather than the whole page waiting
				// on the slowest one. Ordered roughly by which tab needs it first.
				await Promise.all([
					getPriceIndexStats(conn1).then((r) => (dailyPriceIndexStats = r)),
					getSoldAuctionPriceStats(conn2).then((r) => (soldAuctionPriceStats = r)),

					getRamPriceStats(conn3, true).then((r) => (ramWithECCPriceStats = r)),
					getRamPriceStats(conn4, false).then((r) => (ramWithoutECCPriceStats = r)),
					getDiskPriceStats(conn5, 'hdd').then((r) => (hddPriceStats = r)),
					getDiskPriceStats(conn1, 'nvme').then((r) => (nvmePriceStats = r)),
					getDiskPriceStats(conn2, 'sata').then((r) => (sataPriceStats = r)),

					getVolumeStats(conn3, 'Finland').then((r) => (volumeFinlandStats = r)),
					getVolumeStats(conn4, 'Germany').then((r) => (volumeGermanyStats = r)),
					getVolumeByCPUVendorStats(conn5, 'AMD').then((r) => (volumeAMDStats = r)),
					getVolumeByCPUVendorStats(conn1, 'Intel').then((r) => (volumeIntelStats = r)),

					// One grouped query per country instead of a list query plus one
					// per datacenter (27 round trips for Germany alone). Both halves
					// land together so the stack never renders half-populated.
					getVolumeByCountryDatacenters(conn2, 'Finland').then((r) => {
						datacenterVolumeFinlandStats = r;
						finlandDatacenters = Object.keys(r).sort();
					}),
					getVolumeByCountryDatacenters(conn3, 'Germany').then((r) => {
						datacenterVolumeGermanyStats = r;
						germanyDatacenters = Object.keys(r).sort();
					}),

					getVolumeByCPUModelStats(conn4, 'Intel', undefined, 7).then(
						(r) => (intelCPUModelStats = r)
					),
					getVolumeByCPUModelStats(conn5, 'AMD', undefined, 7).then((r) => (amdCPUModelStats = r)),

					// Only feeds the quick stats, so it can arrive last.
					getMinPriceStats(conn1).then((r) => (minPriceStats = r))
				]);
			} catch (error) {
				console.error('Error fetching data:', error);
			}
		});
	}

	$effect(() => {
		if ($db) {
			fetchData($db);
		}
	});
</script>

<svelte:head>
	<title>Hetzner Server Price History &amp; Stats — Server Radar</title>
	<meta
		name="description"
		content="Daily Hetzner server auction statistics: price index, RAM and storage cost per unit, CPU vendor mix and datacenter volume over three months."
	/>
	<link rel="canonical" href="https://radar.iodev.org/statistics" />

	<!-- Open Graph -->
	<meta property="og:title" content="Hetzner Server Price History &amp; Stats — Server Radar" />
	<meta
		property="og:description"
		content="Daily Hetzner server auction statistics: price index, RAM and storage cost per unit, CPU vendor mix and datacenter volume over three months."
	/>
	<meta property="og:url" content="https://radar.iodev.org/statistics" />
	<meta property="og:type" content="website" />
	<meta property="og:image" content="https://radar.iodev.org/images/og-image.webp" />

	<!-- Twitter -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="Hetzner Server Price History &amp; Stats — Server Radar" />
	<meta
		name="twitter:description"
		content="Daily Hetzner server auction statistics: price index, RAM and storage cost per unit, CPU vendor mix and datacenter volume over three months."
	/>

	<!-- Breadcrumb -->
	<script type="application/ld+json">
		{
			"@context": "https://schema.org",
			"@type": "BreadcrumbList",
			"itemListElement": [
				{
					"@type": "ListItem",
					"position": 1,
					"name": "Home",
					"item": "https://radar.iodev.org/"
				},
				{
					"@type": "ListItem",
					"position": 2,
					"name": "Statistics",
					"item": "https://radar.iodev.org/statistics"
				}
			]
		}
	</script>

	<!-- Dataset -->
	<script type="application/ld+json">
		{
			"@context": "https://schema.org",
			"@type": "Dataset",
			"name": "Hetzner Dedicated Server Auction Statistics",
			"description": "Daily aggregates derived from Hetzner's dedicated server auction listings, including a rolling-baseline price index, minimum price per GB of RAM, minimum price per TB of storage by media type, average price of auctions that left the listing, listing volume by country and datacenter, and listing volume by CPU vendor and model.",
			"url": "https://radar.iodev.org/statistics",
			"isAccessibleForFree": true,
			"license": "https://github.com/elsbrock/hetzner-radar/blob/main/LICENSE",
			"creator": {
				"@type": "Person",
				"name": "Simon Elsbrock",
				"url": "https://radar.iodev.org/about"
			},
			"temporalCoverage": "P3M",
			"variableMeasured": [
				{ "@type": "PropertyValue", "name": "Price index (rolling 90-day baseline)" },
				{ "@type": "PropertyValue", "name": "Minimum server price per GB of RAM (ECC and non-ECC)" },
				{ "@type": "PropertyValue", "name": "Minimum server price per TB of HDD storage" },
				{
					"@type": "PropertyValue",
					"name": "Minimum server price per TB of SSD storage (NVMe and SATA)"
				},
				{ "@type": "PropertyValue", "name": "Average price of auctions no longer listed" },
				{ "@type": "PropertyValue", "name": "Listing volume by country (Finland, Germany)" },
				{ "@type": "PropertyValue", "name": "Listing volume by datacenter" },
				{ "@type": "PropertyValue", "name": "Listing volume by CPU vendor (AMD, Intel)" },
				{ "@type": "PropertyValue", "name": "Listing volume by CPU model (top 7 per vendor)" }
			]
		}
	</script>
</svelte:head>

<PageHero
	title="Hetzner auction statistics"
	tagline="Daily aggregates over the last three months: a price index against a rolling baseline, min €/GB RAM, min €/TB storage, and listing volume by country, datacenter and CPU. Judge the market before you commit to a build."
	breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Statistics' }]}
>
	{#snippet meta()}
		<span>
			Looking to buy now?
			<a
				class="text-orange-600 underline-offset-2 hover:underline dark:text-orange-400"
				href="/configurations"
			>
				Today's best deals
			</a>
			or
			<a
				class="text-orange-600 underline-offset-2 hover:underline dark:text-orange-400"
				href="/analyze"
			>
				browse live auctions
			</a>.
		</span>
	{/snippet}
</PageHero>

<div class="mx-auto max-w-6xl px-6 py-10">
	<!-- Key metrics: the page headline, outside the tabs -->
	<section class="mb-10">
		<h2 class="mb-3 text-sm font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
			Key metrics at a glance
		</h2>
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
			<QuickStat
				icon={faChartLine}
				title="Price Index"
				value={currentPriceIndex !== null ? currentPriceIndex.toFixed(3) : null}
				subtitle="Today vs its rolling 90-day median. Lower = cheaper."
			/>

			<QuickStat
				icon={isPriceRising ? faArrowUp : faArrowDown}
				title="30-Day Trend"
				value={priceIndexTrend !== null
					? `${isPriceRising ? '+' : ''}${priceIndexTrend.toFixed(2)}%`
					: null}
				valueClass={isPriceRising ? 'text-red-500' : 'text-green-500'}
				subtitle={priceIndexTrend !== null
					? `Index ${isPriceRising ? 'up' : 'down'} vs 30 days ago (7-day average)`
					: 'Comparing price index over 30 days'}
			/>

			<QuickStat
				icon={faServer}
				title="Lowest Price"
				value={lowestServerPrice !== null
					? `${$currencySymbol}${convertPrice(lowestServerPrice, 'EUR', $currentCurrency).toFixed(2)}`
					: null}
				subtitle="Cheapest server on last recorded day"
			/>

			<QuickStat
				icon={faMemory}
				title="Best €/GB RAM"
				value={bestRamPricePerGB !== null
					? `${$currencySymbol}${convertPrice(bestRamPricePerGB, 'EUR', $currentCurrency).toFixed(3)}`
					: null}
				subtitle="Cheapest server per GB of RAM today"
			/>

			<QuickStat
				icon={faHdd}
				title="NVMe vs HDD"
				value={nvmeHddRatio !== null ? `${nvmeHddRatio}x` : null}
				subtitle="Min server price per TB: NVMe / HDD"
			/>
		</div>
	</section>

	<!--
		One tab strip at every breakpoint: a scrollable pill row on mobile (it
		precedes the panel in the DOM, so it stacks on top), a sticky left rail from
		lg up. From 2xl the rail leaves the grid entirely and hangs in the page
		gutter, so the charts keep the full centered column.
	-->
	<div class="relative lg:grid lg:grid-cols-[200px_1fr] lg:gap-10 2xl:block">
		<aside
			class="mb-8 lg:mb-0 2xl:absolute 2xl:inset-y-0 2xl:right-full 2xl:mr-8 2xl:w-40"
		>
			<div class="lg:sticky lg:top-24">
				<p class="mb-3 hidden text-xs font-semibold text-gray-900 uppercase lg:block dark:text-white">
					Sections
				</p>
				<div
					class="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1 lg:mx-0 lg:flex-col lg:gap-0 lg:overflow-visible lg:border-l lg:border-gray-200 lg:px-0 lg:pb-0 dark:lg:border-gray-700"
					role="tablist"
					aria-label="Statistics sections"
				>
					{#each TABS as tab (tab.id)}
						<button
							type="button"
							role="tab"
							id="stats-tab-{tab.id}"
							aria-selected={activeTab === tab.id}
							aria-controls="stats-panel"
							onclick={() => selectTab(tab.id)}
							title={tab.blurb}
							class="rounded-full border px-4 py-1.5 text-sm whitespace-nowrap transition-colors lg:-ml-px lg:rounded-none lg:border-0 lg:border-l-2 lg:px-0 lg:py-1.5 lg:pl-3 lg:text-left {activeTab ===
							tab.id
								? 'border-orange-500 bg-orange-50 font-medium text-orange-600 lg:bg-transparent dark:bg-orange-500/10 dark:text-orange-400 dark:lg:bg-transparent'
								: 'border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900 lg:border-transparent lg:text-gray-500 dark:border-gray-700 dark:text-gray-400 dark:hover:text-white'}"
						>
							{tab.label}
						</button>
					{/each}
				</div>

				<label
					class="mt-5 flex cursor-pointer items-center gap-2 text-sm text-gray-600 lg:mt-6 dark:text-gray-400"
				>
					<input
						type="checkbox"
						bind:checked={showAverage}
						class="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500 dark:border-gray-600 dark:bg-gray-700"
					/>
					{AVERAGE_WINDOW}-day average
				</label>
				<p class="mt-1 text-xs text-gray-400 dark:text-gray-500">
					Rolling mean over the noisy daily minima. Price charts only.
				</p>
			</div>
		</aside>

		<div
			id="stats-panel"
			role="tabpanel"
			aria-labelledby="stats-tab-{activeTab}"
			tabindex="-1"
			class="min-w-0"
		>
			{#if activeTab === 'index'}
				<h2 class="mb-1 text-2xl font-bold text-gray-800 dark:text-gray-100">Price index</h2>
				<p class="mb-6 max-w-2xl text-sm text-gray-600 dark:text-gray-400">
					Each day's lowest price per configuration is compared to a rolling 90-day median
					baseline for that same configuration, then weighted by how many servers of that
					configuration were listed. An index near 1.0 means median market prices; above 1.0
					means servers are pricier than the recent past, below 1.0 cheaper. Because the
					baseline rolls with each day, historical values stay stable.
				</p>

				<div class="grid grid-cols-1 gap-6">
					<StatCard
						title="Overall price index"
						description="Weighted across every configuration listed that day. Gaps are days with no observations."
						height="h-96"
					>
						<GenericChart type="line" data={priceIndexSeries} options={indexAxis} />
					</StatCard>

					<StatCard
						title="Average sold auction price (daily)"
						description="Average last-observed price of auction servers that left the listing, excluding fixed-price offers. It approximates transaction values, though servers can disappear for reasons other than a sale."
					>
						<GenericChart type="line" data={soldSeries} options={euroAxis('month')} />
					</StatCard>
				</div>
			{:else if activeTab === 'prices'}
				<h2 class="mb-1 text-2xl font-bold text-gray-800 dark:text-gray-100">Prices</h2>
				<p class="mb-6 max-w-2xl text-sm text-gray-600 dark:text-gray-400">
					The cheapest server on offer per unit of hardware — not the price of the component
					itself. A line breaks on days where no server with that hardware was listed.
				</p>

				<div class="grid grid-cols-1 gap-6">
					<StatCard
						title="Server price per GB RAM"
						description="Minimum server price divided by its RAM, split by ECC support. Use it to gauge when memory-heavy builds are cheap."
					>
						<GenericChart type="line" data={ramSeries} options={euroAxis('GB', 3)} />
					</StatCard>

					<StatCard
						title="Server price per TB HDD"
						description="Minimum server price per TB of spinning disk. Handy for timing storage-heavy configurations."
					>
						<GenericChart type="line" data={hddSeries} options={euroAxis('TB')} />
					</StatCard>

					<StatCard
						title="Server price per TB SSD"
						description="Minimum server price per TB of flash, NVMe and SATA tracked separately."
					>
						<GenericChart type="line" data={ssdSeries} options={euroAxis('TB')} />
					</StatCard>
				</div>
			{:else if activeTab === 'volume'}
				<h2 class="mb-1 text-2xl font-bold text-gray-800 dark:text-gray-100">Volume</h2>
				<p class="mb-6 max-w-2xl text-sm text-gray-600 dark:text-gray-400">
					How many distinct servers were listed each day. A day with no listing for a given
					datacenter is a real zero; a day nobody observed leaves a gap in every band.
				</p>

				<div class="grid grid-cols-1 gap-6">
					<StatCard
						title="Volume by country"
						description="Listings in Finland and Germany, stacked to show the total."
					>
						<GenericChart type="line" data={countryVolumeSeries} options={countAxis} />
					</StatCard>

					<StatCard
						title="Volume Intel vs. AMD"
						description="How the auction's CPU mix shifts over time."
					>
						<GenericChart type="line" data={vendorVolumeSeries} options={countAxis} />
					</StatCard>

					<StatCard
						title="Volume by datacenter — Finland"
						description="Availability per Helsinki datacenter."
						height="h-96"
					>
						<GenericChart type="line" data={finlandDatacenterSeries} options={manySeriesLegend} />
					</StatCard>

					<StatCard
						title="Volume by datacenter — Germany"
						description="Availability per Falkenstein and Nuremberg datacenter."
						height="h-96"
					>
						<GenericChart type="line" data={germanyDatacenterSeries} options={manySeriesLegend} />
					</StatCard>
				</div>
			{:else if activeTab === 'cpu'}
				<h2 class="mb-1 text-2xl font-bold text-gray-800 dark:text-gray-100">CPU models</h2>
				<p class="mb-6 max-w-2xl text-sm text-gray-600 dark:text-gray-400">
					The seven highest-volume models per vendor, stacked. Useful for spotting a generation
					being retired into the auction.
				</p>

				<div class="grid grid-cols-1 gap-6">
					<StatCard
						title="Volume by Intel CPU model"
						description="Top 7 Intel models by total listings."
						height="h-96"
					>
						<GenericChart type="line" data={intelModelSeries} options={manySeriesLegend} />
					</StatCard>

					<StatCard
						title="Volume by AMD CPU model"
						description="Top 7 AMD models by total listings."
						height="h-96"
					>
						<GenericChart type="line" data={amdModelSeries} options={manySeriesLegend} />
					</StatCard>
				</div>
			{/if}
		</div>
	</div>
</div>
