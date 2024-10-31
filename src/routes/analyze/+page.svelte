<script context="module" lang="ts">
	declare let pirsch: any;
</script>

<script lang="ts">
	import ServerCard from "$lib/components/ServerCard.svelte";
	import ServerFilter from "$lib/components/ServerFilter.svelte";
	import ServerPriceChart from "$lib/components/ServerPriceChart.svelte";
	import {
	  type ServerConfiguration,
	  type ServerPriceStat,
	  getConfigurations,
	} from "$lib/queries/filter";
	import {
		getPrices,
	} from "$lib/queries/filter";
	import {
		type NameValuePair,
		getCPUModels,
		getDatacenters,
		getLastUpdated,
	} from "$lib/queries/stats";
	import {
	  withDbConnections,
	} from "$lib/dbapi";
	import { convertServerConfigurationToFilter, defaultFilter, getFilterFromURL, encodeFilter, getHetznerLink, type ServerFilter as ServerFilterType, decodeFilterString, isIdenticalFilter, saveFilter, clearFilter, loadFilter } from "$lib/filter";
	import { addToast } from '$lib/toastStore';
	import { AsyncDuckDB } from "@duckdb/duckdb-wasm";
	import { faClockRotateLeft, faMagnifyingGlass, faStopwatch } from "@fortawesome/free-solid-svg-icons";
	import { FontAwesomeIcon, } from "@fortawesome/svelte-fontawesome";
	import dayjs from 'dayjs';
	import { Button, ButtonGroup, Modal, Progressbar, Alert } from "flowbite-svelte";
	import { LinkOutline, InfoCircleSolid } from "flowbite-svelte-icons";
	import { onMount } from "svelte";
	import { db, dbInitProgress } from "../../stores/db";
  import Spinner from "flowbite-svelte/Spinner.svelte";

	let filter: ServerFilterType;

	let hasStoredFilter = false;

	let lastUpdated: number;
	let serverList: ServerConfiguration[] = [];
	let serverPrices: ServerPriceStat[] = [];
	let cpuModels: NameValuePair[] = [];
	let datacenters: NameValuePair[] = [];

	let queryTime: number | undefined;
	let loading = true;

	let showDisclaimer = false;
	let accepted = false;
	let forwardUrl = '';

	let currentHash: string = "";
	const handleHashChange = () => {
		currentHash = window.location.hash;
	};

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

	function handleSaveFilter(event: CustomEvent<void>) {
		saveFilter(filter);
		pirsch("filter-save");
		hasStoredFilter = true;
		addToast({
			color: 'green',
			message: 'Filter saved successfully',
			icon: 'success',
		});
	}

	function handleClearFilter(event: CustomEvent<void>) {
		clearFilter();
		pirsch("filter-clear");
		hasStoredFilter = false;
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

	onMount(() => {
		currentHash = window.location.hash;
		window.addEventListener('hashchange', handleHashChange);

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

		return () => {
			window.removeEventListener('hashchange', handleHashChange);
		};
	});

	function updateDataFromHash(currentHash: string) {
		const newFilter = getFilterFromURL();
		console.log("New filter from hash:", newFilter);
		console.log("Current filter:", filter);
		console.log(isIdenticalFilter(filter, newFilter!));
		if (newFilter && !isIdenticalFilter(filter, newFilter) && !!$db) {
				filter = newFilter;
				console.log("Filter updated from hash:", filter);
				debouncedFetchData($db, filter);
		}
	}

	let totalOffers = 0;
	$: totalOffers = Array.isArray(serverPrices)
		? serverPrices.reduce((acc, val) => acc + val.count, 0)
		: 0;

	$: updateDataFromHash(currentHash);
	
	$: if (!!$db && filter) {
		console.log("Fetching data with filter:", filter);
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
</script>


<Modal title="Before You Go…" bind:open={showDisclaimer} autoclose outsideclose>
	<p class="text-base leading-relaxed text-gray-500 dark:text-gray-400">
		You will be forwarded to a preconfigured Hetzner Server Auction search.
	</p>
	<p class="text-base leading-relaxed text-gray-500 dark:text-gray-400">
		Please note that this search may return multiple results or none, depending
		on availability. Ensure that the server specifications meet your needs.
	</p>
	<p class="text-base leading-relaxed text-gray-500 dark:text-gray-400 font-semibold">
		Also, prices shown on Server Radar exclude VAT, which varies by country.
		Hetzner typically includes VAT automatically, so the final price will be
		higher if you're within the European Union.
	</p>
	<p class="text-base leading-relaxed text-gray-500 dark:text-gray-400">
		This disclaimer will only show once per session.
	</p>
	<svelte:fragment slot="footer">
		<Button on:click={() => {
			accepted = true;
			showDisclaimer = false;
		}} href="{forwardUrl}">
			I understand, take me there
		</Button>
	</svelte:fragment>
</Modal>

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
			{#if loading}
			<p class="mt-1 text-sm font-normal text-gray-500 dark:text-gray-400
			ml-5"><Spinner class="mr-2"/> Loading...</p>
			{:else if serverList.length === 0}
			<Alert class="mx-5"><InfoCircleSolid slot="icon" class="w-5 h-5" />No servers matching the criteria were found. Try
			changing some of the parameters.</Alert>
			{:else}
			<div class="grid grid-cols-[repeat(auto-fill,minmax(300px,auto))] justify-items-start w-full gap-4 px-5 mb-5">
				{#each serverList as config}
					<ServerCard {config} {loading}>
						<ButtonGroup
							slot="buttons"
							size="xs"
							class="
								opacity-100 
								sm:opacity-0 
								group-hover:opacity-100 
								transition-opacity 
								duration-300 
								absolute bottom-4 right-4
								bg-white 
								bg-opacity-75 
								rounded-md 
								flex 
							"
						>
							<Button
								on:click={() =>
									(window.location.hash = `#filter.v2:${encodeFilter(
										convertServerConfigurationToFilter(config)
									)}`)
								}
							>
								<FontAwesomeIcon icon={faMagnifyingGlass} class="w-4 h-4" />
							</Button>
							<Button
								on:click={(e) => {
									if (!accepted) {
										showDisclaimer = true;
										forwardUrl = getHetznerLink(config);
										e.preventDefault();
									}
									e.stopPropagation();
								}}
								href="{getHetznerLink(config)}"
							>
								<LinkOutline class="w-5 h-5" />
							</Button>
						</ButtonGroup>
					</ServerCard>
				{/each}
			</div>
			
			{/if}
		</main>
	</div>
{/if}
