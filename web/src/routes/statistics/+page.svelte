<script lang="ts">
	import LineChart from '$lib/components/LineChart.svelte';
	import { getRamPriceStats, getDiskPriceStats, getGPUPriceStats, initDB, withDbConnections } from '$lib/dbapi';
	import { createDB, tearDownDB } from '$lib/duckdb';
	import type { AsyncDuckDB } from '@duckdb/duckdb-wasm';
	import { onDestroy, onMount } from 'svelte';
	
	export let db: AsyncDuckDB;

	let progress = 0;
	let initialized = false;
	let loading = true;

	let ramPriceStats = [];
	let hddPriceStats = [];
	let nvmePriceStats = [];
	let sataPriceStats = [];
	let gpuPriceStats = [];

	async function fetchData() {
		if (!initialized) {
			return;
		}

		let queryTime = performance.now();
		loading = true;

		await withDbConnections(db, async (conn1, conn2, conn3, conn4, conn5) => {
			try {
				[ramPriceStats, hddPriceStats, nvmePriceStats, sataPriceStats, gpuPriceStats] = await Promise.all([
					getRamPriceStats(conn1),
					getDiskPriceStats(conn2, 'hdd'),
					getDiskPriceStats(conn3, 'nvme'),
					getDiskPriceStats(conn4, 'sata'),
					getGPUPriceStats(conn5),
				]);
				queryTime = performance.now() - queryTime;
			} catch (error) {
				console.error('Error fetching data:', error);
			} finally {
				loading = false;
			}
		});
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

	$: fetchData();
</script>

<div class="mx-auto max-w-3xl p-8">
	<h3
		class="bg-white px-5 pb-5 text-left text-lg font-semibold text-gray-900 dark:bg-gray-800 dark:text-white"
	>
		RAM Price Over Time
		<p class="mt-1 text-sm font-normal text-gray-500 dark:text-gray-400">
			Track the price trends for RAM over time. Use this to gauge when it's most cost-effective to
			invest in memory-intensive servers.
		</p>
		<div class="relative z-0 h-80 w-full">
			<LineChart data={ramPriceStats} />
		</div>
	</h3>

	<h3
		class="bg-white px-5 pb-5 text-left text-lg font-semibold text-gray-900 dark:bg-gray-800 dark:text-white"
	>
		Disk Price Over Time
		<p class="mt-1 text-sm font-normal text-gray-500 dark:text-gray-400">
			Explore how the price of HDD storage has fluctuated over time. This data can help you identify
			trends and determine the best time to purchase storage-heavy configurations.
		</p>
		<div class="relative z-0 h-80 w-full">
			<LineChart data={hddPriceStats} />
		</div>
	</h3>

	<h3
		class="bg-white px-5 pb-5 text-left text-lg font-semibold text-gray-900 dark:bg-gray-800 dark:text-white"
	>
		SSD (NVMe) Price Over Time
		<p class="mt-1 text-sm font-normal text-gray-500 dark:text-gray-400">
			See how SSD prices have changed over time, allowing you to plan your purchases for
			configurations that rely on fast storage solutions.
		</p>
		<div class="relative z-0 h-80 w-full">
			<LineChart data={nvmePriceStats} />
		</div>
	</h3>

	<h3
		class="bg-white px-5 pb-5 text-left text-lg font-semibold text-gray-900 dark:bg-gray-800 dark:text-white"
	>
		SSD (SATA) Price Over Time
		<p class="mt-1 text-sm font-normal text-gray-500 dark:text-gray-400">
			See how SSD prices have changed over time, allowing you to plan your purchases for
			configurations that rely on fast storage solutions.
		</p>
		<div class="relative z-0 h-80 w-full">
			<LineChart data={sataPriceStats} />
		</div>
	</h3>

	<h3
		class="bg-white px-5 pb-5 text-left text-lg font-semibold text-gray-900 dark:bg-gray-800 dark:text-white"
	>
		ECC vs. Non-ECC RAM
		<p class="mt-1 text-sm font-normal text-gray-500 dark:text-gray-400">
			Compare the availability and pricing of ECC (Error-Correcting Code) RAM versus non-ECC RAM in
			server configurations. This helps you decide if ECC is worth the investment for your needs.
		</p>
	</h3>

	<h3
		class="bg-white px-5 pb-5 text-left text-lg font-semibold text-gray-900 dark:bg-gray-800 dark:text-white"
	>
		Cheapest Configuration
		<p class="mt-1 text-sm font-normal text-gray-500 dark:text-gray-400">
			Discover the most affordable server configurations available in different categories:
		</p>
		<ul class="mt-1 list-inside list-disc text-sm font-normal text-gray-500 dark:text-gray-400">
			<li>By HDD: Lowest price for a configuration with HDD storage.</li>
			<li>By RAM: Cheapest option available with the highest RAM.</li>
			<li>By SSD: Most cost-effective configuration featuring SSD storage.</li>
			<li>With GPU: Find the least expensive server with a dedicated GPU.</li>
		</ul>
		<div class="relative z-0 h-80 w-full">
			<LineChart data={gpuPriceStats} />
		</div>
	</h3>

	<h3
		class="bg-white px-5 pb-5 text-left text-lg font-semibold text-gray-900 dark:bg-gray-800 dark:text-white"
	>
		Volume
		<p class="mt-1 text-sm font-normal text-gray-500 dark:text-gray-400">
			Get insights into the overall volume of servers available and break it down by datacenter and
			country:
		</p>
		<ul class="mt-1 list-inside list-disc text-sm font-normal text-gray-500 dark:text-gray-400">
			<li>Overall: Total number of servers observed in the auction.</li>
			<li>Per Datacenter: Distribution of server availability across different datacenters.</li>
			<li>
				Per Country: Breakdown of server volumes by country, helping you choose based on location.
			</li>
		</ul>
	</h3>

	<h3
		class="bg-white px-5 pb-5 text-left text-lg font-semibold text-gray-900 dark:bg-gray-800 dark:text-white"
	>
		CPU Insights
		<p class="mt-1 text-sm font-normal text-gray-500 dark:text-gray-400">
			Dive deep into CPU-related statistics to make informed choices based on your processing needs:
		</p>
		<ul class="mt-1 list-inside list-disc text-sm font-normal text-gray-500 dark:text-gray-400">
			<li>By Vendor: Analyze the distribution and pricing of CPUs by different vendors.</li>
			<li>By Datacenter: See which datacenters offer specific CPU models more frequently.</li>
			<li>
				By Model: Compare pricing and availability of different CPU models to find the best fit for
				your workload.
			</li>
		</ul>
	</h3>
</div>
