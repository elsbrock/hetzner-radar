<script lang="ts">
	import LineChart from '$lib/components/LineChart.svelte';
	import { db } from '../../stores/db';
	import {
		getRamPriceStats,
		getDiskPriceStats,
		getGPUPriceStats,
		getCPUVendorPriceStats,
		getVolumeStats,
		type TemporalStat,
	} from '$lib/queries/stats';
	import { withDbConnections } from '$lib/dbapi';
	import type { AsyncDuckDB } from '@duckdb/duckdb-wasm';

	let loading = true;

	let ramWithECCPriceStats: TemporalStat[] = [];
	let ramWithoutECCPriceStats: TemporalStat[] = [];
	let hddPriceStats: TemporalStat[] = [];
	let nvmePriceStats: TemporalStat[] = [];
	let sataPriceStats: TemporalStat[] = [];
	let gpuPriceStats: TemporalStat[] = [];
	let cpuVendorAMDStats: TemporalStat[] = [];
	let cpuVendorIntelStats: TemporalStat[] = [];
	let volumeFinlandStats: TemporalStat[] = [];
	let volumeGermanyStats: TemporalStat[] = [];

	async function fetchData(db: AsyncDuckDB) {
		let queryTime = performance.now();
		loading = true;

		await withDbConnections(db, async (conn1, conn2, conn3, conn4, conn5) => {
			try {
				[
					ramWithECCPriceStats,
					ramWithoutECCPriceStats,
					hddPriceStats,
					nvmePriceStats,
					sataPriceStats,
					gpuPriceStats,
					cpuVendorAMDStats,
					cpuVendorIntelStats,
					volumeFinlandStats,
					volumeGermanyStats
				] = await Promise.all([
					getRamPriceStats(conn2, true),
					getRamPriceStats(conn3, false),
					getDiskPriceStats(conn4, 'hdd'),
					getDiskPriceStats(conn5, 'nvme'),
					getDiskPriceStats(conn1, 'sata'),
					getGPUPriceStats(conn1),
					getCPUVendorPriceStats(conn2, 'AMD'),
					getCPUVendorPriceStats(conn2, 'Intel'),
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

	$: if (!!$db) {
		fetchData($db);
	}
</script>

<div class="min-h-screen p-8 bg-gray-50">
	<section class="mx-auto my-12 max-w-7xl text-center">
		<h1 class="mb-6 text-5xl font-extrabold text-gray-800">Dive into our Auction Statistics</h1>
		<p class="text-lg text-gray-600 mb-10">
			Explore comprehensive insights into server availability, pricing trends, and configuration distributions to optimize your infrastructure investments.
		</p>
	</section>

	<div class="mx-auto my-12 max-w-7xl text-center">
		<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
			<!-- RAM Price Over Time -->
			<div class="overflow-hidden rounded-lg bg-white shadow-md dark:bg-gray-800">
				<div class="p-6">
					<h3 class="text-xl font-bold text-gray-900 dark:text-white">RAM Price Over Time</h3>
					<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
						Track the price trends for RAM over time. Use this to gauge when it's most cost-effective to invest in memory-intensive servers.
					</p>
				</div>
				<div class="h-80 w-full">
					<LineChart
						data={[
							{ name: 'With ECC', data: ramWithECCPriceStats },
							{ name: 'Without ECC', data: ramWithoutECCPriceStats }
						]}
					/>
				</div>
			</div>

			<!-- Disk Price Over Time -->
			<div class="overflow-hidden rounded-lg bg-white shadow-md dark:bg-gray-800">
				<div class="p-6">
					<h3 class="text-xl font-bold text-gray-900 dark:text-white">Disk Price Over Time</h3>
					<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
						Explore how the price of one GB HDD storage has fluctuated over time. This data can help you determine the best time to purchase storage-heavy configurations.
					</p>
				</div>
				<div class="h-80 w-full">
					<LineChart data={[{ name: 'HDD Price', data: hddPriceStats }]} />
				</div>
			</div>

			<!-- SSD Price Over Time -->
			<div class="overflow-hidden rounded-lg bg-white shadow-md dark:bg-gray-800">
				<div class="p-6">
					<h3 class="text-xl font-bold text-gray-900 dark:text-white">SSD Price Over Time</h3>
					<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
						See how one GB of SSD storage have changed over time, allowing you to plan your purchases for configurations that rely on fast storage solutions.
					</p>
				</div>
				<div class="h-80 w-full">
					<LineChart
						data={[
							{ name: 'NVMe', data: nvmePriceStats },
							{ name: 'SATA', data: sataPriceStats }
						]}
					/>
				</div>
			</div>

			<!-- Cheapest GPU Configuration -->
			<div class="overflow-hidden rounded-lg bg-white shadow-md dark:bg-gray-800">
				<div class="p-6">
					<h3 class="text-xl font-bold text-gray-900 dark:text-white">Cheapest GPU Configuration</h3>
					<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
						Compare the price trends for servers with GPUs to make informed decisions when selecting a graphics card for your server.
					</p>
				</div>
				<div class="h-80 w-full">
					<LineChart data={[{ name: 'GPU', data: gpuPriceStats }]} />
				</div>
			</div>

			<!-- Volume by Country -->
			<div class="overflow-hidden rounded-lg bg-white shadow-md dark:bg-gray-800">
				<div class="p-6">
					<h3 class="text-xl font-bold text-gray-900 dark:text-white">Volume by Country</h3>
					<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
						Analyze the volume of servers deployed in different regions to identify trends and make informed decisions about where to expand your infrastructure.
					</p>
				</div>
				<div class="h-80 w-full">
					<LineChart
						data={[
							{ name: 'Finland', data: volumeFinlandStats },
							{ name: 'Germany', data: volumeGermanyStats }
						]}
						options={{
							chart: {
								stacked: true,
								type: "area",
							},
							yaxis: {
								title: {
									text: 'Volume',
								},
								labels: {
									formatter: function (value) {
										return value.toFixed(0);
									},
								},
							},
							dataLabels: {
								enabled: false
							},
						}}
					/>
				</div>
			</div>

			<!-- CPU Vendors -->
			<div class="overflow-hidden rounded-lg bg-white shadow-md dark:bg-gray-800">
				<div class="p-6">
					<h3 class="text-xl font-bold text-gray-900 dark:text-white">CPU Vendors</h3>
					<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
						Compare the price trends for CPUs from different vendors to make informed decisions when selecting a processor for your server.
					</p>
				</div>
				<div class="h-80 w-full">
					<LineChart
						data={[
							{ name: 'AMD', data: cpuVendorAMDStats },
							{ name: 'Intel', data: cpuVendorIntelStats }
						]}
					/>
				</div>
			</div>
		</div>
	</div>
</div>
