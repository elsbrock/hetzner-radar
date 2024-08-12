<script lang="ts">
	import { initDB, getCPUModels, getDatacenters, getConfigurations, getPrices } from '$lib/dbapi';
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

		let [conn1, conn2, conn3, conn4] = await Promise.all([
			db.connect(),
			db.connect(),
			db.connect(),
			db.connect()
		]);

		let queryTime = performance.now();
		loading = true;
		try {
			[cpuModels, datacenters, serverPrices, serverList] = await Promise.all([
				getCPUModels(conn1, filter),
				getDatacenters(conn2, filter),
				getPrices(conn3, filter),
				getConfigurations(conn4, filter)
			]);
		} catch (error) {
			console.error('Error fetching data:', error);
		} finally {
			loading = false;
			queryTime = performance.now() - queryTime;
			if (umami) {
					umami.track((props) => ({
					...props,
					name: 'search-result',
					data: {
						filter: { ...filter },
						results: serverList.length,
						queryTime
					},
				}));
			}
			return Promise.all([conn1.close(), conn2.close(), conn3.close(), conn4.close()]);
		}
	}

	onMount(async () => {
		db = await createDB();
		await initDB(db, (loaded, total) => {
			progress = Math.round((loaded / total) * 100);
		});
		initialized = true;
		return fetchData();
	});

	onDestroy(async () => {
		initialized = false;
		return tearDownDB();
	});

	$: fetchData(filter);
</script>

{#if progress != 100}
	<div class="flex min-h-screen items-center justify-center">
		<div class="w-[40vw]"><Progressbar {progress} labelOutside="Loading data…" /></div>
	</div>
{:else}
	<div class="grid min-h-screen grid-cols-1 sm:grid-cols-1 lg:grid-cols-[auto,1fr]">
		<Filter bind:filter {datacenters} {cpuModels} />

		<main class="flex-grow overflow-y-auto pt-3">
			<ServerPriceChart data={serverPrices} {loading} />
			<ServerTable data={serverList} {loading} />
		</main>
	</div>
{/if}
