<script context="module" lang="ts">
	declare let pirsch: any;
</script>

<script lang="ts">
	import { db, dbInitProgress } from "../../stores/db";
	import type {
		NameValuePair,
		ServerConfiguration,
		ServerDetail,
		ServerFilter as ServerFilterType,
		ServerLowestPriceStat,
		ServerPriceStat,
	} from "$lib/dbapi";
	import {
		getLastUpdated,
		getCPUModels,
		getDatacenters,
		getConfigurations,
		getPrices,
		withDbConnections,
		getServerDetails,
		getServerDetailPrices,
		getLowestServerDetailPrices,
	} from "$lib/dbapi";
	import { Progressbar } from "flowbite-svelte";
	import ServerFilter from "$lib/components/ServerFilter.svelte";
	import ServerTable from "$lib/components/ServerTable.svelte";
	import ServerPriceChart from "$lib/components/ServerPriceChart.svelte";
	import { AsyncDuckDB } from "@duckdb/duckdb-wasm";
	import { onMount } from "svelte";
	import dayjs from 'dayjs';
	import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
	import { faClockRotateLeft, faStopwatch } from "@fortawesome/free-solid-svg-icons";
	import { addToast } from '$lib/toastStore';
  import { defaultFilter, getFilterFromURL } from "$lib/filter";

	let filter: ServerFilterType;

	let hasStoredFilter = false;

	let lastUpdated: number;
	let serverList: ServerConfiguration[] = [];
	let serverPrices: ServerPriceStat[] = [];
	let cpuModels: NameValuePair[] = [];
	let datacenters: NameValuePair[] = [];
	let serverDetails: ServerDetail[];
	let serverDetailPrices: ServerPriceStat[];
	let lowestServerDetailPrices: ServerLowestPriceStat[];

	let queryTime: number | undefined;
	let loading = true;

	async function fetchData(db: AsyncDuckDB, filter: ServerFilterType) {
		console.log("Fetching data with filter:", filter);
		let queryStart = performance.now();

		if (typeof pirsch !== "undefined") {
			pirsch("search", {});
		}

		await withDbConnections(db, async (conn1, conn2, conn3, conn4) => {
			try {
				[cpuModels, datacenters, serverPrices, serverList] = await Promise.all([
					getCPUModels(conn1, filter),
					getDatacenters(conn2, filter),
					getPrices(conn3, filter),
					getConfigurations(conn4, filter),
				]);

				queryTime = performance.now() - queryStart;
			} catch (error: Error | any) {
				console.error("Error fetching data:", error);
				pirsch("search-error", { error: error?.message });
			} finally {
				loading = false;
			}
		});
	}

	async function handleServerDetails(event: any) {
		return withDbConnections($db!, async (conn1, conn2, conn3) => {
			[serverDetails, serverDetailPrices, lowestServerDetailPrices] =
				await Promise.all([
					getServerDetails(conn1, serverList[event.detail]),
					getServerDetailPrices(conn2, serverList[event.detail]),
					getLowestServerDetailPrices(conn3, serverList[event.detail]),
				]);
		});
	}

	function loadFilter(): ServerFilterType | null {
		const storedFilter = localStorage.getItem('radar-filter');
		if (storedFilter) {
			return JSON.parse(storedFilter);
		}
		return null;
	}

	function handleSaveFilter(event: CustomEvent<void>) {
		saveFilter(filter);
	}

	function saveFilter(filter: ServerFilter) {
		pirsch("filter-save");
		localStorage.setItem('radar-filter', JSON.stringify(filter));
		hasStoredFilter = true;
		addToast({
			color: 'green',
			message: 'Filter saved successfully',
			icon: 'success',
		});
	}

	function handleClearFilter(event: CustomEvent<void>) {
		hasStoredFilter = false;
		clearFilter();
	}

	function clearFilter() {
		pirsch("filter-clear");
		localStorage.removeItem('radar-filter');
		addToast({
			color: 'red',
			message: 'Filter cleared successfully',
			icon: 'error',
		});
	}

	function debounce(fn: any, delay: number) {
		let timeoutID: number;
		return function(...args: any) {
			clearTimeout(timeoutID);
			loading = true;
			timeoutID = setTimeout(() => fn(...args), timeoutID ? delay : 0) as any;
		};
	}

	const debouncedFetchData = debounce(fetchData, 500);
	$: if (!!$db && filter) {
		// TODO: generate at build time
		if (!lastUpdated) {
			withDbConnections($db, async (conn1) => {
				let lastUpdate = await getLastUpdated(conn1);
				if (lastUpdate.length > 0) {
					lastUpdated = lastUpdate[0].last_updated;
				}
			});
		}
		debouncedFetchData($db, filter);
	}

	onMount(async () => {
		const filterFromURL = getFilterFromURL();
		const storedFilter = loadFilter();
		if (filterFromURL) {
			console.log("using filter from URL");
			filter = filterFromURL;
		} else {
			if (storedFilter) {
				addToast({
					color: 'green',
					message: 'Using stored filter settings',
					icon: 'success',
				});
				filter = storedFilter;
				hasStoredFilter = true;
			} else {
				filter = defaultFilter;
			}
		}
	});

	let totalOffers = 0;
	$: totalOffers = Array.isArray(serverPrices)
		? serverPrices.reduce((acc, val) => acc + val.count, 0)
		: 0;
</script>

{#if !Number.isNaN($dbInitProgress) && $dbInitProgress < 100}
<div class="flex flex-col flex-1 px-4 py-8 bg-gray-50" style="padding: 28% 0">
  <!-- Loader Container -->
  <div class="flex-grow flex items-center justify-center">
    <div class="w-full max-w-md p-6 bg-white rounded-lg shadow-md">
      <h2 class="text-xl font-semibold text-gray-700 mb-4">Hang tight</h2>
      <Progressbar
        progress={$dbInitProgress}
				labelInside
				animate={true}
				 size="h-4"
      />
      <p class="mt-5 text-sm text-gray-500">Please wait while we initialize our
      data. This should only take a couple of seconds.</p>
    </div>
  </div>
</div>
{:else if filter}
	<div
		class="grid min-h-screen grid-cols-1 sm:grid-cols-1 lg:grid-cols-[auto,1fr]"
	>
		<aside
		class="border-r border-gray-200 dark:border-gray-700 dark:bg-gray-800 overflow-y-auto">
			<div class="h-full bg-white px-3 py-2 dark:bg-gray-800">
				<ServerFilter bind:filter on:saveFilter={handleSaveFilter} on:clearFilter={handleClearFilter} {hasStoredFilter} {datacenters} {cpuModels}
				/>
				<div class="mt-4">
					<hr class="mb-5" />
						{#if lastUpdated}
							<p class="mt-2 text-center text-xs italic text-gray-500 dark:text-gray-400">
								<FontAwesomeIcon icon={faClockRotateLeft} class="me-1"/>{dayjs.unix(lastUpdated).format('DD.MM.YYYY HH:mm')}
							</p>
						{/if}
						{#if queryTime}
							<p class="mt-2 text-center text-xs italic text-gray-500 dark:text-gray-400">
								<FontAwesomeIcon icon={faStopwatch} class="me-1"/>completed in {queryTime.toFixed(0)}ms
							</p>
						{/if}
					</div>
			</div>
		</aside>

		<main class="flex-grow overflow-y-auto pt-3">
			<div class="w-full">
				<h3
					class="bg-white px-5 pb-5 text-left text-lg font-semibold text-gray-900 dark:bg-gray-800 dark:text-white"
				>
					Pricing
					<p class="mt-1 text-sm font-normal text-gray-500 dark:text-gray-400">
						View the minimum, mean, and maximum server prices observed for the
						given configuration over the last three months. {#if totalOffers > 0}A
							total of {totalOffers} offers have been seen.{/if}
					</p>
				</h3>
				<ServerPriceChart data={serverPrices} {loading} />
			</div>
			<h3
				class="bg-white px-5 pb-5 text-left text-lg font-semibold text-gray-900 dark:bg-gray-800 dark:text-white"
			>
				Configurations
				<p class="mt-1 text-sm font-normal text-gray-500 dark:text-gray-400">
					Below is a list of unique server configurations we have observed over time. It includes their
					minimum prices and the dates the configurations were last seen. Keep in mind that this is not
					equal to the total number of servers that were offered, which is usually much
					higher. You can see the bid volume in the chart above.
				</p>
			</h3>
			<ServerTable
				data={serverList}
				on:serverDetails={handleServerDetails}
				{serverDetails}
				{serverDetailPrices}
				{lowestServerDetailPrices}
				{loading}
			/>
		</main>
	</div>
{/if}
