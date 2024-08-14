<script lang="ts">
	import { dbStore, initializedStore, progressStore } from '../../stores/db';
	import { getCPUModels, getDatacenters, getConfigurations, getPrices, withDbConnections } from '$lib/dbapi';
	import { Progressbar } from 'flowbite-svelte';
	import Filter from '$lib/components/Filter.svelte';
	import ServerTable from '$lib/components/ServerTable.svelte';
	import ServerPriceChart from '$lib/components/ServerPriceChart.svelte';
	import { onDestroy, onMount } from 'svelte';
	import { AsyncDuckDB } from '@duckdb/duckdb-wasm';
	import { createDB, tearDownDB } from '$lib/duckdb';

	declare var umami: any;

	let progress = 0;
	let db: AsyncDuckDB;

	let filter = {
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

	let serverList: any[] = [];
	let serverPrices: any[] = [];
	let cpuModels: any[] = [];
	let datacenters: any[] = [];

	let loading = true;

	async function fetchData() {
		if (!initialized || !filter) {
			return;
		}

		let queryTime = performance.now();
		loading = true;

		await withDbConnections(db, async (conn1, conn2, conn3, conn4) => {
			try {
				[cpuModels, datacenters, serverPrices, serverList] = await Promise.all([
					getCPUModels(conn1, filter),
					getDatacenters(conn2, filter),
					getPrices(conn3, filter),
					getConfigurations(conn4, filter)
				]);

				queryTime = performance.now() - queryTime;

				umami.track((props) => ({
					...props,
					name: 'search-result',
					data: {
						filter: { ...filter },
						results: serverList.length,
						queryTime
					},
				}));
			} catch (error) {
				console.error('Error fetching data:', error);
			} finally {
				loading = false;
			}
		});
	}

	async function handleServerDetails(event: any) {
		console.log('Server details requested:', serverList[event.detail]);
		// umami.track((props) => ({
		// 	...props,
		// 	name: 'server-details',
		// 	data: {
		// 		server: serverList[index]
		// 	},
		// }));
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

	$: if (initialized && db) {
		fetchData(filter);
	}
</script>

{#if !Number.isNaN(progress) && progress < 100}
	<div class="flex min-h-screen items-center justify-center">
		<div class="w-[40vw]"><Progressbar {progress} labelOutside="Loading data…" /></div>
	</div>
{:else}
	<div class="grid min-h-screen grid-cols-1 sm:grid-cols-1 lg:grid-cols-[auto,1fr]">
		<Filter bind:filter {datacenters} {cpuModels} />

		<main class="flex-grow overflow-y-auto pt-3">
			<ServerPriceChart data={serverPrices} {loading} />
			<ServerTable data={serverList} on:serverDetails={handleServerDetails} {loading} />
		</main>
	</div>
{/if}
