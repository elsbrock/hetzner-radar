<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidate, invalidateAll, replaceState } from '$app/navigation';
	import { page } from '$app/stores';
	import type { PriceAlert } from '$lib/api/backend/alerts';
	import { withDbConnections } from '$lib/api/frontend/dbapi';
	import {
		type ServerConfiguration,
		type ServerPriceStat,
		getConfigurations,
		getPrices
	} from '$lib/api/frontend/filter';
	import {
		type NameValuePair,
		getCPUModels,
		getDatacenters,
		getLastUpdated,
		getPopularityStats
	} from '$lib/api/frontend/stats';
	import AlertModal from '$lib/components/AlertModal.svelte';
	import DbLoadingProgress from '$lib/components/DBLoadingProgress.svelte';
	import FloatingActionButton from '$lib/components/FloatingActionButton.svelte';
	import GroupControls from '$lib/components/GroupControls.svelte';
	import OutdatedDataAlert from '$lib/components/OutdatedDataAlert.svelte';
	import PriceControls from '$lib/components/PriceControls.svelte';
	import QuickStat from '$lib/components/QuickStat.svelte';
	import ServerFilter from '$lib/components/ServerFilter.svelte';
	import ServerList from '$lib/components/ServerList.svelte';
	import ServerPriceChart from '$lib/components/ServerPriceChart.svelte';
	import SortControls from '$lib/components/SortControls.svelte';
	import { vatOptions } from '$lib/components/VatSelector.svelte';
	// FAB component
	import {
		type ServerFilter as ServerFilterType,
		clearFilter,
		isIdenticalFilter,
		loadFilter,
		saveFilter
	} from '$lib/filter';
	import { filter } from '$lib/stores/filter';
	import { settingsStore, currencySymbol, currentCurrency } from '$lib/stores/settings';
	import { convertPrice } from '$lib/currency';
	import { addToast } from '$lib/stores/toast';
	import { debounce } from '$lib/util';
	import type { AsyncDuckDB } from '@duckdb/duckdb-wasm';
	import {
		faArrowDown, // FAB icon
		faArrowUp,
		faBars,
		faBell,
		faEuroSign,
		faFilter,
		faFire,
		faStopwatch,
		faTableCellsLarge,
		faWarning
	} from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import dayjs from 'dayjs';
	import { Alert, Button, ButtonGroup, Input, InputAddon, Spinner, Tooltip } from 'flowbite-svelte';
	import { InfoCircleSolid } from 'flowbite-svelte-icons';
	import { onMount } from 'svelte';
	// Import slide transition
	import { browser } from '$app/environment';
	import { db, dbInitProgress, initializeDB } from '../../stores/db';
	import {
		buildDisplayList,
		collectPrices,
		countServers,
		type GroupByField,
		type GroupedServerList,
		type SortField
	} from './insights';

	let { data } = $props<{ data: import('./$types').PageData }>();

	let lastUpdate: number | undefined = $state(undefined);
	let serverList: ServerConfiguration[] = $state([]);
	let serverPrices: ServerPriceStat[] = $state([]);
	let cpuModels: NameValuePair[] = $state([]);
	let datacenters: NameValuePair[] = $state([]);
	let priceMin: number | undefined = $state(undefined);
	let priceMax: number | undefined = $state(undefined);
	let sortField: SortField = $state('price');
	let sortDirection: 'asc' | 'desc' = $state('asc');
	let groupByField: GroupByField = $state('none');
	let viewMode: 'grid' | 'list' = $state(
		($settingsStore.viewMode as 'grid' | 'list' | undefined) ?? 'grid'
	);
	function setViewMode(mode: 'grid' | 'list') {
		viewMode = mode;
		settingsStore.updateSetting('viewMode', mode);
	}
	let queryTime: number | undefined = $state(undefined);
	let loading = $state(true);
	let selectedAlert: PriceAlert | null = $state(null);
	let alertDialogOpen = $state(false);
	let storedFilter: ServerFilterType | null = $state(null);

let isFilterCollapsed = $state(false);
let mounted: boolean = $state(false);

let filterIsIntersecting: boolean = $state(true);
let resultsAreIntersecting: boolean = $state(false);
let isSmallScreen: boolean = $state(false);
	function handleSaveFilter(e: Event) {
		saveFilter($filter);
		addToast({ message: 'Filter saved.', color: 'green', icon: 'success' });
		storedFilter = $filter;
		e.preventDefault();
		e.stopPropagation();
	}

	function handleClearFilter(e: Event) {
		clearFilter();
		addToast({ message: 'Filter cleared.', color: 'green', icon: 'success' });
		storedFilter = null;
		e.preventDefault();
		e.stopPropagation();
	}

	// URL parameter names for view state
	const URL_PARAM_GROUP = 'group';
	const URL_PARAM_SORT = 'sort';
	const URL_PARAM_DIR = 'dir';
	const URL_PARAM_COLLAPSED = 'collapsed';

	// Valid values for URL params
	const validGroupByFields: GroupByField[] = ['none', 'cpu_vendor', 'cpu_model', 'best_price'];
	const validSortFields: SortField[] = ['price', 'ram', 'storage', 'cpu_score', 'cpu_multicore_score'];
	const validSortDirections: ('asc' | 'desc')[] = ['asc', 'desc'];

	// Track last URL state to avoid unnecessary updates
	let lastViewStateUrl = $state('');

	// Update URL with current view state (debounced)
	function updateViewStateUrl() {
		if (typeof window === 'undefined') return;

		const url = new URL(window.location.href);

		// Only add non-default values to URL
		if (groupByField !== 'none') {
			url.searchParams.set(URL_PARAM_GROUP, groupByField);
		} else {
			url.searchParams.delete(URL_PARAM_GROUP);
		}

		if (sortField !== 'price') {
			url.searchParams.set(URL_PARAM_SORT, sortField);
		} else {
			url.searchParams.delete(URL_PARAM_SORT);
		}

		if (sortDirection !== 'asc') {
			url.searchParams.set(URL_PARAM_DIR, sortDirection);
		} else {
			url.searchParams.delete(URL_PARAM_DIR);
		}

		if (isFilterCollapsed) {
			url.searchParams.set(URL_PARAM_COLLAPSED, '1');
		} else {
			url.searchParams.delete(URL_PARAM_COLLAPSED);
		}

		const newUrlString = url.toString();
		if (newUrlString !== lastViewStateUrl) {
			lastViewStateUrl = newUrlString;
			 
			replaceState(url.pathname + url.search, window.history.state);
		}
	}

	const debouncedUpdateViewStateUrl = debounce(updateViewStateUrl, 300);

	onMount(() => {
		initializeDB();
		storedFilter = loadFilter();

		// Read view state from URL on mount
		const urlParams = $page.url.searchParams;

		const groupParam = urlParams.get(URL_PARAM_GROUP);
		if (groupParam && validGroupByFields.includes(groupParam as GroupByField)) {
			groupByField = groupParam as GroupByField;
		}

		const sortParam = urlParams.get(URL_PARAM_SORT);
		if (sortParam && validSortFields.includes(sortParam as SortField)) {
			sortField = sortParam as SortField;
		}

		const dirParam = urlParams.get(URL_PARAM_DIR);
		if (dirParam && validSortDirections.includes(dirParam as 'asc' | 'desc')) {
			sortDirection = dirParam as 'asc' | 'desc';
		}

		const collapsedParam = urlParams.get(URL_PARAM_COLLAPSED);
		if (collapsedParam === '1') {
			isFilterCollapsed = true;
		}

		// Initialize lastViewStateUrl to current URL to avoid immediate update
		lastViewStateUrl = window.location.href;

		function updateSidebarHeight() {
			// Measure header and footer heights
			const nav = document.querySelector('nav') as HTMLElement | null;
			const footer = document.querySelector('footer') as HTMLElement | null;
			const bannerElement = (document.querySelector('#cloud-availability-alerts') ||
				document.querySelector('[id*="banner"]')) as HTMLElement | null;

			let totalOffset = 0;
			if (nav) totalOffset += nav.offsetHeight;
			if (footer) totalOffset += footer.offsetHeight;
			if (bannerElement && bannerElement.offsetHeight > 0)
				totalOffset += bannerElement.offsetHeight; // Only if banner is visible

			// Set CSS custom property
			document.documentElement.style.setProperty('--header-footer-height', `${totalOffset}px`);
		}

		// Initial calculation
		updateSidebarHeight();

		// Recalculate when banner visibility might change
		const observer = new MutationObserver(updateSidebarHeight);
		const observedBanner = (document.querySelector('[data-testid="banner"]') ||
			document.querySelector('.banner')) as HTMLElement | null;
		if (observedBanner) {
			observer.observe(observedBanner.parentElement || document.body, {
				childList: true,
				subtree: true,
				attributes: true,
				attributeFilter: ['style', 'class']
			});
		}

		// Cleanup observer on component destroy
		return () => observer.disconnect();
	});

	// Sync view state to the URL.
	//
	// The four values are combined into one derived key rather than assigned to
	// four unused `_`-prefixed locals inside the effect. The key is then actually
	// compared, so the dependency is real and the effect fires only when the view
	// state genuinely changed — not on every unrelated re-run.
	//
	// `updateViewStateUrl` deliberately still reads the individual values itself:
	// it also snapshots `window.location.href`, and must do that when the debounce
	// fires rather than when the state changed, so it does not clobber the `filter`
	// param that ServerFilter writes on its own debounce.
	let viewState = $derived(`${groupByField}|${sortField}|${sortDirection}|${isFilterCollapsed}`);

	// Plain let, not $state: written from the effect that reads it.
	let lastSyncedViewState = '';

	$effect(() => {
		const state = viewState;

		// Only update URL after initial mount (when lastViewStateUrl is set)
		if (browser && lastViewStateUrl !== '' && state !== lastSyncedViewState) {
			lastSyncedViewState = state;
			debouncedUpdateViewStateUrl();
		}
	});

	// Effect for setting up Intersection Observers and screen size checks (client-side only)
	$effect(() => {
		if (!browser) return; // Ensure this runs only in the browser

		// Delay rendering of dynamic content until client has mounted
		// This helps prevent hydration mismatches for complex conditional UI
		mounted = true;

		// Media Query for small screens
		const mediaQuery = window.matchMedia('(max-width: 1024px)'); // lg breakpoint
		const updateScreenSize = () => {
			isSmallScreen = mediaQuery.matches;

			// If screen size changes, we need to re-evaluate visibility immediately
			// This ensures FAB state is correct before observers fire
			if (isSmallScreen) {
				// On small screens, assume filter is visible initially (top of page)
				filterIsIntersecting = true;
				resultsAreIntersecting = false;
			} else {
				// On larger screens, reset the state
				filterIsIntersecting = false;
				resultsAreIntersecting = false;
			}
		};
		updateScreenSize(); // Initial check
		mediaQuery.addEventListener('change', updateScreenSize);

		// Intersection Observers
		const filterSection = document.getElementById('filter-section');
		const resultsSection = document.getElementById('results-section');
		let filterObserver: IntersectionObserver | null = null;
		let resultsObserver: IntersectionObserver | null = null;

		const observerOptions = {
			root: null, // Use the viewport as the root
			rootMargin: '0px',
			threshold: 0.1 // Trigger when 10% is visible
		};

		const setupObservers = () => {
			// Disconnect previous observers if they exist
			filterObserver?.disconnect();
			resultsObserver?.disconnect();

			if (isSmallScreen && filterSection && resultsSection) {
				filterObserver = new IntersectionObserver((entries) => {
					entries.forEach((entry) => {
						filterIsIntersecting = entry.isIntersecting;
					});
				}, observerOptions);
				filterObserver.observe(filterSection);

				resultsObserver = new IntersectionObserver((entries) => {
					entries.forEach((entry) => {
						resultsAreIntersecting = entry.isIntersecting;
					});
				}, observerOptions);
				resultsObserver.observe(resultsSection);
			} else {
				// On larger screens, reset the state
				filterIsIntersecting = false;
				resultsAreIntersecting = false;
			}
		};

		setupObservers(); // Initial setup based on current screen size

		// Cleanup function
		return () => {
			mediaQuery.removeEventListener('change', updateScreenSize);
			filterObserver?.disconnect();
			resultsObserver?.disconnect();
		};
	});

	async function fetchData(dbInstance: AsyncDuckDB, currentFilter: ServerFilterType) {
		loading = true;
		let queryStart = performance.now();
		try {
			await withDbConnections(dbInstance, async (conn1, conn2, conn3, conn4, conn5) => {
				const [
					cpuModelsResult,
					datacentersResult,
					serverPricesResult,
					serverListResult,
					popularityResult
				] = await Promise.all([
					getCPUModels(conn1, currentFilter),
					getDatacenters(conn2, currentFilter),
					getPrices(conn3, currentFilter),
					getConfigurations(conn4, currentFilter),
					getPopularityStats(conn5, currentFilter)
				]);

				cpuModels = cpuModelsResult;
				datacenters = datacentersResult;
				serverPrices = serverPricesResult;
				serverList = serverListResult;

				popularityValue = popularityResult;
				queryTime = performance.now() - queryStart;

				// Refresh last update timestamp
				if (!lastUpdate || dayjs().diff(lastUpdate, 'minute') > 65) {
					withDbConnections(dbInstance, async (conn1) => {
						let last = await getLastUpdated(conn1);
						if (last.length > 0) lastUpdate = last[0].last_updated;
					});
				}
			});
		} catch (error: unknown) {
			console.error('Error fetching data:', error);
			addToast({
				message: 'Failed to fetch server data.',
				color: 'red',
				icon: 'error'
			});
		} finally {
			loading = false;
		}
	}

	const debouncedFetchData = debounce(fetchData, 500);

	// Effect to fetch data when db or filter changes
	$effect(() => {
		if ($db && $filter) {
			debouncedFetchData($db, $filter);
		}
	});

	// The filter/sort/group pipeline lives in ./insights.ts. It used to be a
	// ~190-line $effect that copied its seven dependencies into locals and ran
	// inside setTimeout(…, 10) before assigning groupedDisplayList — derivation
	// spelled as a deferred side effect, so the list always trailed its inputs by
	// at least a frame. As a $derived it is synchronous and unit-tested.
	//
	// _calculateMedian / _calculatePercentile went with it: both were dead,
	// underscore-prefixed to pass lint.
	let vatRate = $derived.by(() => {
		const countryCode =
			($settingsStore?.vatSelection?.countryCode as keyof typeof vatOptions) ?? 'NET';
		return (countryCode in vatOptions ? vatOptions[countryCode] : vatOptions['NET']).rate;
	});

	let groupedDisplayList: GroupedServerList = $derived(
		buildDisplayList({
			servers: serverList,
			priceMin,
			priceMax,
			vatRate,
			sortField,
			sortDirection,
			groupBy: groupByField
		})
	);

	// Derived state for total results count from grouped list
	let totalResults = $derived(countServers(groupedDisplayList));

	// Popularity comes from an async query, so it is genuine state. Everything else
	// on the QuickStat row is derived from it or from groupedDisplayList — see below.
	let popularityValue = $state<number | null>(1); // Default to 1 (neutral)

	let popularityFormatted = $derived(
		popularityValue === null || (popularityValue >= 0.8 && popularityValue <= 1.2)
			? 'Normal'
			: popularityValue > 1.2
				? 'High'
				: 'Low'
	);

	let availableAuctionsValue = $derived(
		Array.isArray(serverPrices) && serverPrices.length > 0
			? (serverPrices[serverPrices.length - 1]?.count ?? 0)
			: 0
	);

	// Derived state for UI flags (can remain derived)
	let hasFilter = $derived(storedFilter !== null);
	let updateStoredFilterDisabled = $derived(isIdenticalFilter($filter, storedFilter));

	// Hide chart when only showing standard servers (no historical price data for them)
	let showOnlyStandard = $derived($filter?.showStandard && !$filter?.showAuction);

	// Format price with VAT and timeUnitPrice for display
	let selectedTimeUnit = $derived((
		$settingsStore.timeUnitPrice ?? 'perMonth'
	) as 'perMonth' | 'perHour');

	function formatPrice(price: number | null): string {
		if (price === null || Number.isNaN(price) || !Number.isFinite(price)) return 'N/A';

		const countryCode =
			($settingsStore?.vatSelection?.countryCode as keyof typeof vatOptions) ?? 'NET';
		const selectedOption = countryCode in vatOptions ? vatOptions[countryCode] : vatOptions['NET'];
		const vatRate = selectedOption.rate || 0; // Ensure rate is a number
		const timeUnit = selectedTimeUnit;

		// Apply VAT
		const priceWithVat = price * (1 + vatRate);

		if (!Number.isFinite(priceWithVat)) return 'N/A';

		// Convert to selected currency
		const convertedPrice = convertPrice(priceWithVat, 'EUR', $currentCurrency);
		const symbol = $currencySymbol;

		// Format based on time unit
		if (timeUnit === 'perHour') {
			// Convert monthly price to hourly (divide by hours in a month)
			const hourlyPrice = convertedPrice / (30 * 24);
			return `${hourlyPrice.toFixed(4)} ${symbol}/h`;
		} else {
			// Monthly price
			return `${convertedPrice.toFixed(2)} ${symbol}/mo`;
		}
	}

	// QuickStat figures. These were written from a $effect into $state that the
	// comment called "non-derived variables" — including three `_`-prefixed values
	// that were assigned and never read, and a totalResultsValue that duplicated
	// totalResults. They are all pure functions of groupedDisplayList.
	let displayedPrices = $derived(collectPrices(groupedDisplayList));

	let lowestPrice = $derived(
		displayedPrices.length > 0 ? Math.min(...displayedPrices) : null
	);
	let averagePrice = $derived(
		displayedPrices.length > 0
			? displayedPrices.reduce((sum, price) => sum + price, 0) / displayedPrices.length
			: null
	);
	let priceRange = $derived(
		displayedPrices.length > 0
			? Math.max(...displayedPrices) - Math.min(...displayedPrices)
			: null
	);

	/** Formats a statistic, falling back to 'N/A' for absent or non-finite values. */
	function formatStat(value: number | null): string {
		return value !== null && Number.isFinite(value) ? formatPrice(value) : 'N/A';
	}

	let lowestPriceFormatted = $derived(formatStat(lowestPrice));
	let averagePriceFormatted = $derived(formatStat(averagePrice));
	let priceRangeFormatted = $derived(formatStat(priceRange));

	// Ensure priceMin/Max are numbers when changed
	function handlePriceMinChange(event: Event) {
		const input = event.target as HTMLInputElement;
		priceMin = input.value === '' ? undefined : Number(input.value);
	}
	function handlePriceMaxChange(event: Event) {
		const input = event.target as HTMLInputElement;
		priceMax = input.value === '' ? undefined : Number(input.value);
	}

	const breadcrumbJsonLd = {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: [
			{ '@type': 'ListItem', position: 1, name: 'Home', item: 'https://radar.iodev.org/' },
			{
				'@type': 'ListItem',
				position: 2,
				name: 'Server Search',
				item: 'https://radar.iodev.org/analyze'
			}
		]
	};
</script>

<svelte:head>
	<title>Hetzner Auction Server Search &amp; Price History — Server Radar</title>
	<meta
		name="description"
		content="Filter live Hetzner auction listings by CPU, RAM, storage, and location. See price history per configuration and set alerts on price drops."
	/>
	<link rel="canonical" href="https://radar.iodev.org/analyze" />

	<meta
		property="og:title"
		content="Hetzner Auction Server Search & Price History — Server Radar"
	/>
	<meta
		property="og:description"
		content="Filter live Hetzner auction listings by CPU, RAM, storage, and location. See price history per configuration and set alerts on price drops."
	/>
	<meta property="og:url" content="https://radar.iodev.org/analyze" />
	<meta property="og:type" content="website" />
	<meta property="og:image" content="https://radar.iodev.org/images/og-image.webp" />

	<meta name="twitter:card" content="summary_large_image" />
	<meta
		name="twitter:title"
		content="Hetzner Auction Server Search & Price History — Server Radar"
	/>
	<meta
		name="twitter:description"
		content="Filter live Hetzner auction listings by CPU, RAM, storage, and location. See price history per configuration and set alerts on price drops."
	/>
	<meta name="twitter:image" content="https://radar.iodev.org/images/og-image.webp" />

	{@html `<script type="application/ld+json">${JSON.stringify(breadcrumbJsonLd)}</` + `script>`}
</svelte:head>

<div class="mx-auto h-full max-w-[1680px]">
	<div
		class="border-b border-gray-200 bg-white px-5 py-2 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
	>
		<h1 class="inline text-sm font-semibold text-gray-800 dark:text-gray-200">
			Hetzner auction server search
		</h1>
		<span>
			— filter live auction listings by CPU, RAM, storage, and location, with price history per
			configuration. Set
			<a href="/alerts" class="text-orange-500 hover:underline">price alerts</a> to get notified on
			drops, or read the
			<a href="/guide" class="text-orange-500 hover:underline">guide</a> if you're new to the auction.
		</span>
	</div>
	<OutdatedDataAlert lastUpdate={lastUpdate ?? 0} />
	<AlertModal
		bind:open={alertDialogOpen}
		alert={selectedAlert}
		user={data.user || { notification_preferences: { email: true, discord: false, webhook: false } }}
		on:success={() => invalidateAll()}
	/>
	{#if !Number.isNaN($dbInitProgress) && $dbInitProgress < 100}
		<DbLoadingProgress />
	{:else}
		<div
			class="grid h-full grid-cols-1 sm:grid-cols-1 md:border-r-2
        md:border-r-gray-100 lg:grid-cols-[auto_1fr] dark:border-r-gray-700"
		>
			<!-- ID for Intersection Observer -->
			<aside
				id="filter-section"
				class="flex flex-col border-r border-l border-gray-200 bg-white transition-[width] duration-300 ease-in-out dark:border-gray-700 dark:bg-gray-800
                    {isFilterCollapsed ? 'sm:w-16 md:w-16' : 'sm:w-80 md:w-80'}"
				style="min-height: calc(100vh - var(--header-footer-height, 200px));"
			>
				<!-- ServerFilter Container - Grows and Scrolls -->
				<div class="grow overflow-y-auto px-6 py-4">
					<ServerFilter
						{datacenters}
						{cpuModels}
						{lastUpdate}
						{queryTime}
						{loading}
						bind:isFilterCollapsed
					/>
				</div>
			</aside>

			<main class="grow overflow-y-auto bg-white dark:bg-gray-900">
				<div class="w-full">
					<div
						class="mb-3 grid grid-cols-1 items-start gap-3 border-b border-gray-200 bg-white px-5 py-3 text-left text-lg font-semibold text-gray-900 sm:border-t md:grid-cols-2 md:border-t-0 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
					>
						<!-- Left-aligned controls: scrollable on mobile with fixed fade -->
						<div
							class="relative after:pointer-events-none after:absolute after:top-0 after:right-0 after:bottom-0 after:w-8 after:bg-linear-to-l after:from-white after:to-transparent after:content-[''] md:col-span-1 md:after:hidden dark:after:from-gray-800"
						>
							<div
								class="scrollbar-hide flex flex-nowrap items-start gap-3 overflow-x-auto text-xs text-gray-900 dark:text-gray-300"
							>
								<ButtonGroup class="h-8 shrink-0">
									<InputAddon
										size="sm"
										class="bg-gray-50 text-gray-900 dark:bg-gray-700 dark:text-gray-300"
									>
										<FontAwesomeIcon icon={faEuroSign} class="me-2 dark:text-gray-400" />Price
									</InputAddon>
									<Input
										size="sm"
										type="number"
										min="0"
										step="1"
										placeholder="min"
										data-testid="price-min-input"
										class="w-16! [appearance:textfield] bg-white text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
										bind:value={priceMin}
										onchange={handlePriceMinChange}
									/>
									<Input
										size="sm"
										type="number"
										min="0"
										step="1"
										placeholder="max"
										data-testid="price-max-input"
										class="w-16! [appearance:textfield] bg-white text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
										bind:value={priceMax}
										onchange={handlePriceMaxChange}
									/>
								</ButtonGroup>
								<ButtonGroup class="h-8 shrink-0">
									<InputAddon
										size="sm"
										class="bg-gray-50 text-gray-900 dark:bg-gray-700 dark:text-gray-300"
									>
										<FontAwesomeIcon class="me-2" icon={faFilter} />Filter
									</InputAddon>
									<Button
										size="xs"
										color="alternative"
										class="shadow-xs"
										data-testid="filter-save"
										disabled={updateStoredFilterDisabled}
										onclick={handleSaveFilter}
									>
										{#if hasFilter}
											Update
										{:else}
											Save
										{/if}
									</Button>
									{#if hasFilter}
										<Button
											size="xs"
											color="alternative"
											class="shadow-xs"
											data-testid="filter-clear"
											onclick={handleClearFilter}>Delete</Button
										>
									{/if}
								</ButtonGroup>
								<Tooltip placement="bottom" class="z-50 text-center">
									Store current filter locally<br />
									on your computer.
								</Tooltip>

								{#if !showOnlyStandard}
								<ButtonGroup class="h-8 shrink-0">
									<InputAddon
										size="sm"
										class="bg-gray-50 text-gray-900 dark:bg-gray-700 dark:text-gray-300"
									>
										<FontAwesomeIcon class="me-2 text-orange-500" icon={faBell} /> Alert
									</InputAddon>
									{#await data?.alert then alert}
										{#if alert}
											<Button
												color="alternative"
												size="xs"
												id="price-alert"
												onclick={(e: MouseEvent) => {
													alertDialogOpen = true;
													selectedAlert = alert;
													e.stopPropagation();
												}}
											>
												Edit
											</Button>
											<form
												method="POST"
												action="/alerts?/delete"
												use:enhance={() => {
													addToast({
														color: 'green',
														message: 'Alert deleted successfully.',
														icon: 'success'
													});
													selectedAlert = null;
													invalidate('/analyze');
												}}
											>
												<input type="hidden" name="alertId" value={alert.id} />
												<Button
													color="alternative"
													size="xs"
													id="price-alert-delete"
													type="submit"
													onclick={(e: MouseEvent) => {
														selectedAlert = null;
														e.stopPropagation();
													}}
												>
													Delete
												</Button>
											</form>
										{:else}
											<Button
												color="alternative"
												size="xs"
												id="price-alert"
												onclick={(e: MouseEvent) => {
													alertDialogOpen = true;
													e.stopPropagation();
												}}
											>
												Create
											</Button>
											<Tooltip placement="bottom" class="z-50 text-center">
												Get a notification once your<br />
												preferred price has been reached.
											</Tooltip>
										{/if}
									{/await}
								</ButtonGroup>
							{/if}
							</div>
						</div>

						<div class="col-span-1 flex justify-end">
							<PriceControls />
						</div>
					</div>

					<div class="grid grid-cols-2 gap-4 px-5 md:grid-cols-3 lg:grid-cols-6">
						<!-- Total Available Configurations -->
						<QuickStat
							data-testid="total-configurations"
							icon={faFilter}
							title="Total Configurations"
							value={totalResults}
							subtitle="Available server configurations"
							size="sm"
							loading={loading}
						/>

						<!-- Available Auctions -->
						<QuickStat
							icon={faFire}
							title="Available Auctions"
							value={availableAuctionsValue}
							subtitle="Currently available auctions"
							size="sm"
						/>

						<!-- Server Popularity -->
						<QuickStat
							data-testid="popularity-stat"
							icon={popularityValue && popularityValue > 1.2
								? faArrowUp
								: popularityValue && popularityValue < 0.8
									? faArrowDown
									: faStopwatch}
							title="Server Popularity"
							value={popularityFormatted}
							subtitle="Compared to 30-day average"
							valueClass={popularityValue && popularityValue > 1.2
								? 'text-green-600 dark:text-green-400'
								: popularityValue && popularityValue < 0.8
									? 'text-red-600 dark:text-red-400'
									: 'text-gray-900 dark:text-white'}
							size="sm"
						/>

						<!-- Lowest Price -->
						<QuickStat
							icon={faEuroSign}
							title="Lowest Price"
							value={lowestPriceFormatted}
							subtitle="Most affordable option"
							valueClass="text-green-600 dark:text-green-400"
							size="sm"
							loading={loading}
						/>

						<!-- Average Price -->
						<QuickStat
							icon={faEuroSign}
							title="Average Price"
							value={averagePriceFormatted}
							subtitle="Across all configurations"
							size="sm"
							loading={loading}
						/>

						<!-- Price Range -->
						<QuickStat
							icon={faArrowDown}
							title="Price Range"
							value={priceRangeFormatted}
							subtitle="Highest minus lowest price"
							size="sm"
							loading={loading}
						/>
					</div>

					{#if !showOnlyStandard}
						<div class="h-[320px] pt-5">
							<ServerPriceChart data={serverPrices} {loading} timeUnitPrice={selectedTimeUnit} />
						</div>
					{/if}
				</div>

				{#if browser && mounted}
					<!-- Defer rendering this section until client-side mount to avoid hydration issues -->
					<!-- ID for Intersection Observer -->
					<div
						id="results-section"
						class="mt-5 flex flex-col px-5 sm:flex-row sm:items-start sm:justify-between"
					>
						<!-- Group heading and badge -->
						<div class="flex items-baseline">
							<h3 class="me-2 text-left text-xl font-semibold text-gray-900 dark:text-white">
								Configurations
							</h3>
						</div>
						{#if !loading}
							<!-- Sort & Group controls: Stacked on mobile, right-aligned on larger screens -->
							<div
								class="mt-2 flex flex-wrap items-center justify-start gap-x-4 gap-y-2 text-sm text-gray-500 sm:mt-0 sm:justify-end dark:text-gray-400"
							>
								<GroupControls bind:groupByField />
								<SortControls bind:sortField bind:sortDirection />
								<!-- View mode toggle (grid / list) -->
								<div
									class="inline-flex h-8 overflow-hidden rounded-md ring-1 ring-gray-200 dark:ring-gray-700"
									role="group"
									aria-label="View mode"
								>
									<button
										type="button"
										class={`flex items-center justify-center px-3 transition-colors ${viewMode === 'grid' ? 'bg-gray-100 text-gray-900 dark:bg-gray-600 dark:text-gray-100' : 'bg-white text-gray-400 hover:text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}
										onclick={() => setViewMode('grid')}
										aria-pressed={viewMode === 'grid'}
										aria-label="Grid view"
									>
										<FontAwesomeIcon icon={faTableCellsLarge} class="h-4 w-4" />
									</button>
									<button
										type="button"
										class={`flex items-center justify-center px-3 transition-colors ${viewMode === 'list' ? 'bg-gray-100 text-gray-900 dark:bg-gray-600 dark:text-gray-100' : 'bg-white text-gray-400 hover:text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}
										onclick={() => setViewMode('list')}
										aria-pressed={viewMode === 'list'}
										aria-label="List view"
									>
										<FontAwesomeIcon icon={faBars} class="h-4 w-4" />
									</button>
								</div>
							</div>
						{/if}
					</div>
					{#if loading}
						<!-- Loading Spinner -->
						<p class="mt-1 ml-5 text-sm font-normal text-gray-500 dark:text-gray-400">
							<Spinner class="mr-2" /> Loading...
						</p>
					{:else}
						<!-- Content to show when NOT loading -->
						{#if totalResults > 0}
							<!-- Show >100 Alert if needed -->
							{#if totalResults > 100}
								<Alert class="mx-5 mt-4" color="red">
									<FontAwesomeIcon icon={faWarning} class="me-1 h-4 w-4" />
									We found more than 100 configurations and limited the results. Please use the filter
									to narrow down the results.
								</Alert>
							{/if}

							<!-- Show Server List -->
							<div class="relative">
								{#if loading}
									<div class="pointer-events-none absolute inset-0 z-20 flex justify-center bg-white/60 pt-16 backdrop-blur-xs dark:bg-gray-900/60">
										<div class="flex h-fit items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-gray-700 shadow-lg dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200">
											<Spinner size="4" />
											<span class="text-sm">Updating...</span>
										</div>
									</div>
								{/if}
								<ServerList
									groupedList={groupedDisplayList}
									timeUnitPrice={selectedTimeUnit}
									{viewMode}
								/>
							</div>
						{:else}
							<!-- Show No Results Alert -->
							<Alert class="mx-5 mt-4">
								{#snippet icon()}
									<InfoCircleSolid class="h-5 w-5" />
								{/snippet}
								No servers matching the criteria were found. Try changing some of the parameters.
							</Alert>
						{/if}
					{/if}
				{/if}
				<!-- End of browser && mounted block -->
			</main>
		</div>

		<!-- Floating Action Buttons for Small Screens -->
		<FloatingActionButton
			icon={faArrowDown}
			targetSelector="#results-section"
			visible={isSmallScreen && filterIsIntersecting && !resultsAreIntersecting}
			priority={10}
			ariaLabel="Scroll to results"
		/>
		<FloatingActionButton
			icon={faArrowUp}
			targetSelector="#filter-section"
			visible={isSmallScreen && !filterIsIntersecting && resultsAreIntersecting}
			priority={10}
			ariaLabel="Scroll to filter"
		/>
	{/if}
</div>
