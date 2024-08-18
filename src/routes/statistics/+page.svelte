<script lang="ts">
	import LineChart from '$lib/components/LineChart.svelte';
	import { dbStore, initializedStore, progressStore } from '../../stores/db';
	import {
		getRamPriceStats,
		getDiskPriceStats,
		getGPUPriceStats,
		getCPUVendorPriceStats,
		getVolumeStats,
		withDbConnections,
		type TemporalStat
	} from '$lib/dbapi';
	import type { AsyncDuckDB } from '@duckdb/duckdb-wasm';

	export let db: AsyncDuckDB;

	let progress = 0;
	let initialized = false;
	let loading = true;

	let ramPriceStats: TemporalStat[] = [];
	let ramWithECCPriceStats: TemporalStat[] = [];
	let ramWithoutECCPriceStats: TemporalStat[] = [];
	let hddPriceStats: TemporalStat[] = [];
	let nvmePriceStats: TemporalStat[] = [];
	let sataPriceStats: TemporalStat[] = [];
	let gpuPriceStats: TemporalStat[] = [];
	let cpuVendorAMDStats: TemporalStat[] = [];
	let cpuVendorIntelStats: TemporalStat[] = [];
	let volumeStats: TemporalStat[] = [];
	let volumeFinlandStats: TemporalStat[] = [];
	let volumeGermanyStats: TemporalStat[] = [];

	async function fetchData() {
		if (!initialized) {
			return;
		}

		let queryTime = performance.now();
		loading = true;

		await withDbConnections(db, async (conn1, conn2, conn3, conn4, conn5) => {
			try {
				[
					ramPriceStats,
					ramWithECCPriceStats,
					ramWithoutECCPriceStats,
					hddPriceStats,
					nvmePriceStats,
					sataPriceStats,
					gpuPriceStats,
					cpuVendorAMDStats,
					cpuVendorIntelStats,
					volumeStats,
					volumeFinlandStats,
					volumeGermanyStats
				] = await Promise.all([
					getRamPriceStats(conn1),
					getRamPriceStats(conn2, true),
					getRamPriceStats(conn3, false),
					getDiskPriceStats(conn4, 'hdd'),
					getDiskPriceStats(conn5, 'nvme'),
					getDiskPriceStats(conn1, 'sata'),
					getGPUPriceStats(conn1),
					getCPUVendorPriceStats(conn2, 'AMD'),
					getCPUVendorPriceStats(conn2, 'Intel'),
					getVolumeStats(conn3),
					getVolumeStats(conn3, 'Finland'),
					getVolumeStats(conn3, 'Germany')
				]);
				queryTime = performance.now() - queryTime;
			} catch (error) {
				console.error('Error fetching data:', error);
			} finally {
				loading = false;
			}
		});
	}

	dbStore.subscribe((value) => {
		db = value;
	});

	initializedStore.subscribe((value) => {
		initialized = value;
	});

	progressStore.subscribe((value) => {
		progress = value;
	});

	$: if (initialized && db) {
		fetchData();
	}
</script>

<div class="mx-auto grid max-w-7xl grid-cols-1 gap-8 p-8 md:grid-cols-2">
	<!-- RAM Price Over Time -->
	<div
		class="bg-white px-5 pb-5 text-left text-lg font-semibold text-gray-900 dark:bg-gray-800 dark:text-white"
	>
		<h3>RAM Price Over Time</h3>
		<p class="mt-1 text-sm font-normal text-gray-500 dark:text-gray-400">
			Track the price trends for RAM over time. Use this to gauge when it's most cost-effective to
			invest in memory-intensive servers.
		</p>
		<div class="relative z-0 h-80 w-full">
			<LineChart
				data={[
					{ name: 'Any', data: ramPriceStats },
					{ name: 'With ECC', data: ramWithECCPriceStats },
					{ name: 'Without ECC', data: ramWithoutECCPriceStats }
				]}
			/>
		</div>
	</div>

	<!-- Disk Price Over Time -->
	<div
		class="bg-white px-5 pb-5 text-left text-lg font-semibold text-gray-900 dark:bg-gray-800 dark:text-white"
	>
		<h3>Disk Price Over Time</h3>
		<p class="mt-1 text-sm font-normal text-gray-500 dark:text-gray-400">
			Explore how the price of HDD storage has fluctuated over time. This data can help you 
			determine the best time to purchase storage-heavy configurations.
		</p>
		<div class="relative z-0 h-80 w-full">
			<LineChart data={[{ name: 'HDD Price', data: hddPriceStats }]} />
		</div>
	</div>

	<!-- SSD Price Over Time -->
	<div
		class="bg-white px-5 pb-5 text-left text-lg font-semibold text-gray-900 dark:bg-gray-800 dark:text-white"
	>
		<h3>SSD Price Over Time</h3>
		<p class="mt-1 text-sm font-normal text-gray-500 dark:text-gray-400">
			See how SSD prices have changed over time, allowing you to plan your purchases for
			configurations that rely on fast storage solutions.
		</p>
		<div class="relative z-0 h-80 w-full">
			<LineChart
				data={[
					{ name: 'NVMe', data: nvmePriceStats },
					{ name: 'SATA', data: sataPriceStats }
				]}
			/>
		</div>
	</div>

	<!-- Cheapest Configuration -->
	<div
		class="bg-white px-5 pb-5 text-left text-lg font-semibold text-gray-900 dark:bg-gray-800 dark:text-white"
	>
		<h3>Cheapest GPU Configuration</h3>
		<p class="mt-1 text-sm font-normal text-gray-500 dark:text-gray-400">
			Compare the price trends for GPUs to make informed decisions when selecting a graphics card
			for your server.
		</p>
		<div class="relative z-0 h-80 w-full">
			<LineChart data={[{ name: 'GPU', data: gpuPriceStats }]} />
		</div>
	</div>

	<!-- Volume -->
	<div
		class="bg-white px-5 pb-5 text-left text-lg font-semibold text-gray-900 dark:bg-gray-800 dark:text-white"
	>
		<h3>Volume by Country</h3>
		<p class="mt-1 text-sm font-normal text-gray-500 dark:text-gray-400">
			Analyze the volume of servers deployed in different regions to identify trends and make
			informed decisions about where to expand your infrastructure.
		</p>
		<div class="relative z-0 h-80 w-full">
			<LineChart
				data={[
					{ name: 'Total', data: volumeStats },
					{ name: 'Finland', data: volumeFinlandStats },
					{ name: 'Germany', data: volumeGermanyStats }
				]}
			/>
		</div>
	</div>

	<!-- CPU Insights -->
	<div
		class="bg-white px-5 pb-5 text-left text-lg font-semibold text-gray-900 dark:bg-gray-800 dark:text-white"
	>
		<h3>CPU Vendors</h3>
		<p class="mt-1 text-sm font-normal text-gray-500 dark:text-gray-400">
			Compare the price trends for CPUs from different vendors to make informed decisions when
			selecting a processor for your server.
		</p>
		<div class="relative z-0 h-80 w-full">
			<LineChart
				data={[
					{ name: 'AMD', data: cpuVendorAMDStats },
					{ name: 'Intel', data: cpuVendorIntelStats }
				]}
			/>
		</div>
	</div>
</div>
