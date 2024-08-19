<script lang="ts">
	import { dbStore, initializedStore, progressStore } from '../../stores/db';
	import type { NameValuePair, ServerConfiguration, ServerDetails, ServerFilter, ServerLowestPriceStat, ServerPriceStat } from '$lib/dbapi';
	import { getCPUModels, getDatacenters, getConfigurations, getPrices, withDbConnections, getServerDetails, getServerDetailPrices, getLowestServerDetailPrices } from '$lib/dbapi';
	import { Progressbar } from 'flowbite-svelte';
	import Filter from '$lib/components/Filter.svelte';
	import ServerTable from '$lib/components/ServerTable.svelte';
	import ServerPriceChart from '$lib/components/ServerPriceChart.svelte';
	import { AsyncDuckDB } from '@duckdb/duckdb-wasm';

	declare var umami: any;

	let progress = 0;
	let db: AsyncDuckDB | null = null;

	let filter: ServerFilter = {
		locationGermany: true,
		locationFinland: true,

		cpuCount: 1,
		cpuIntel: true,
		cpuAMD: true,

		ramInternalSizeLower: 4,
		ramInternalSizeUpper: 6,

		ssdNvmeCountLower: 2,
		ssdNvmeCountUpper: 5,
		ssdNvmeInternalSizeLower: 8,
		ssdNvmeInternalSizeUpper: 12,

		ssdSataCountLower: 0,
		ssdSataCountUpper: 5,
		ssdSataInternalSizeLower: 8,
		ssdSataInternalSizeUpper: 12,

		hddCountLower: 0,
		hddCountUpper: 5,
		hddInternalSizeLower: 8,
		hddInternalSizeUpper: 12,

		selectedDatacenters: [],
		selectedCpuModels: [],

		extrasECC: null,
		extrasINIC: null,
		extrasHWR: false,
		extrasGPU: false
	};

	let initialized = false;

	let serverList: ServerConfiguration[] = [];
	let serverPrices: ServerPriceStat[] = [];
	let cpuModels: NameValuePair[] = [];
	let datacenters: NameValuePair[] = [];
	let serverDetails: ServerDetails[];
	let serverDetailPrices: ServerPriceStat[];
	let lowestServerDetailPrices: ServerLowestPriceStat[];

	let loading = true;

	async function fetchData() {
		if (!initialized || !filter) {
			return;
		}

		let queryTime = performance.now();
		loading = true;

		await withDbConnections(db!, async (conn1, conn2, conn3, conn4) => {
			try {
				[cpuModels, datacenters, serverPrices, serverList] = await Promise.all([
					getCPUModels(conn1, filter),
					getDatacenters(conn2, filter),
					getPrices(conn3, filter),
					getConfigurations(conn4, filter)
				]);

				queryTime = performance.now() - queryTime;

				umami.track('search-result');
			} catch (error) {
				console.error('Error fetching data:', error);
			} finally {
				loading = false;
			}
		});
	}

	async function handleServerDetails(event: any) {
		console.log('Server details requested:', serverList[event.detail]);
		return withDbConnections(db!, async (conn1, conn2, conn3) => {
			[serverDetails, serverDetailPrices, lowestServerDetailPrices]  = await Promise.all([
				getServerDetails(conn1, serverList[event.detail]),
				getServerDetailPrices(conn2, serverList[event.detail]),
				getLowestServerDetailPrices(conn3, serverList[event.detail]),
			]);
		});
	};

	dbStore.subscribe(value => {
		db = value;
	});

	initializedStore.subscribe(value => {
		initialized = value;
	});

	progressStore.subscribe(value => {
		progress = value;
	});

	$: if (initialized && db && filter) {
		fetchData();
	}

	let totalOffers = 0;
	$: totalOffers = Array.isArray(serverPrices) ? serverPrices.reduce((acc, val) => acc + val.count, 0) : 0;
</script>

{#if !Number.isNaN(progress) && progress < 100}
	<div class="flex min-h-screen items-center justify-center">
		<div class="w-[40vw]"><Progressbar {progress} labelOutside="Loading data…" /></div>
	</div>
{:else}
	<div class="grid min-h-screen grid-cols-1 sm:grid-cols-1 lg:grid-cols-[auto,1fr]">
		<Filter bind:filter {datacenters} {cpuModels} />

		<main class="flex-grow overflow-y-auto pt-3">
			<div class="w-full">
				<h3
					class="bg-white px-5 pb-5 text-left text-lg font-semibold text-gray-900 dark:bg-gray-800 dark:text-white"
				>
					Pricing
					<p class="mt-1 text-sm font-normal text-gray-500 dark:text-gray-400">
						View the minimum, mean, and maximum server prices observed for the given configuration over
						the last three months. {#if totalOffers > 0}A total of {totalOffers} offers have been seen.{/if}
					</p>
				</h3>
				<ServerPriceChart data={serverPrices} {loading} />
			</div>
			<ServerTable data={serverList} on:serverDetails={handleServerDetails} {serverDetails} {serverDetailPrices} {lowestServerDetailPrices} {loading} />
		</main>
	</div>
{/if}
