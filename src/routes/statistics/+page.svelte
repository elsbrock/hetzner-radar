<script lang="ts">
	import LineChart from '$lib/components/LineChart.svelte';
	import { db } from '../../stores/db';
	import {
		getCheapestConfigurations,
		getCheapestDiskConfigurations,
		getCheapestRamConfigurations,
		getRamPriceStats,
		getDiskPriceStats,
		getGPUPriceStats,
		getCPUVendorPriceStats,
		getVolumeStats,
		withDbConnections,
		type TemporalStat,
    	type ServerConfiguration,
	} from '$lib/dbapi';
	import type { AsyncDuckDB } from '@duckdb/duckdb-wasm';
  import { Button, Card, Badge } from 'flowbite-svelte';
  import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
  import { faHardDrive, faMemory, faMicrochip } from '@fortawesome/free-solid-svg-icons';
  import { getFormattedDiskSize, getFormattedMemorySize } from '$lib/disksize';
  import Footer from '$lib/components/Footer.svelte';
  import { convertServerConfigurationToFilter, getFilterString } from '$lib/filter';

	let loading = true;

	let cheapestConfigurations: ServerConfiguration[] = [];
	let cheapDiskConfigurations: ServerConfiguration[] = [];
	let cheapRamConfigurations: ServerConfiguration[] = [];
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
					cheapestConfigurations,
					cheapDiskConfigurations,
					cheapRamConfigurations,
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
					getCheapestConfigurations(conn1),
					getCheapestDiskConfigurations(conn1),
					getCheapestRamConfigurations(conn1),
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
	<div class="mx-auto my-12 max-w-7xl text-center">
		<h1 class="text-4xl font-bold mb-6 text-center text-gray-800">Statistics</h1>
		<p class="mt-2 mb-8 text-lg text-gray-700 dark:text-gray-300">
			Explore comprehensive insights into server availability, pricing trends, and configuration distributions to optimize your infrastructure investments.
		</p>

		<h3 class="text-2xl font-bold mb-6 text-center text-gray-800">Cheapest Configurations</h3>
		<div class="grid grid-cols-2 gap-6 md:grid-cols-4 mb-10">
			{#each cheapestConfigurations as config}
			<Card class="text-left mb-6">
				<h5 class="mb-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{config.cpu}</h5>
				<div class="mb-3">
					{#if config.is_ecc}<span><Badge border>ECC</Badge></span>{/if}
					{#if config.hdd_drives.length > 0}<span><Badge border>HDD</Badge></span>{/if}
					{#if config.nvme_drives.length > 0 || config.sata_drives.length > 0}<span><Badge border>SSD</Badge></span>{/if}
					{#if config.with_inic}<span><Badge border>iNIC</Badge></span>{/if}
					{#if config.with_gpu}<span><Badge border>GPU</Badge></span>{/if}
					{#if config.with_rps}<span><Badge border>RPS</Badge></span>{/if}
				</div>
				<p class="font-normal text-gray-700 dark:text-gray-400 leading-tight">
					<FontAwesomeIcon icon={faMemory} class="me-1 w-4" /> {config.ram_size} GB RAM<br/>
					<FontAwesomeIcon icon={faHardDrive} class="me-1 w-4" /> {getFormattedDiskSize(config.hdd_size + config.nvme_size + config.sata_size)} Storage<br/>
				</p>
				<div class="flex justify-between items-center mt-3">
					<span class="text-xl font-bold text-gray-900 dark:text-white">{config.price} €</span>
					<Button outline href="/analyze#filter.v2:{getFilterString(convertServerConfigurationToFilter(config))}">View</Button>
				</div>
			</Card>
			{/each}
		</div>

		<h3 class="text-2xl font-bold mb-6 text-center text-gray-800">Cheapest by Disk Space</h3>
		<div class="grid grid-cols-2 gap-6 md:grid-cols-4 mb-10">
			{#each cheapDiskConfigurations as config}
			<Card class="text-left mb-6">
				<h5 class="mb-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{config.cpu}</h5>
				<div class="mb-3">
					{#if config.is_ecc}<span><Badge border>ECC</Badge></span>{/if}
					{#if config.hdd_drives.length > 0}<span><Badge border>HDD</Badge></span>{/if}
					{#if config.nvme_drives.length > 0 || config.sata_drives.length > 0}<span><Badge border>SSD</Badge></span>{/if}
					{#if config.with_inic}<span><Badge border>iNIC</Badge></span>{/if}
					{#if config.with_gpu}<span><Badge border>GPU</Badge></span>{/if}
					{#if config.with_rps}<span><Badge border>RPS</Badge></span>{/if}
				</div>
				<p class="font-normal text-gray-700 dark:text-gray-400 leading-tight">
					<FontAwesomeIcon icon={faMemory} class="me-1 w-4" /> {config.ram_size} GB RAM<br/>
					<FontAwesomeIcon icon={faHardDrive} class="me-1 w-4" /> {getFormattedDiskSize(config.hdd_size + config.nvme_size + config.sata_size)} Storage<br/>
				</p>
				<div class="flex justify-between items-center mt-3">
					<span class="text-xl font-bold text-gray-900 dark:text-white">{config.price} € <span class="text-gray-400 text-xs">{(config.price / (config.hdd_size / 1000)).toFixed(2)} € / TB</span></span>
					<Button outline href="/analyze#filter.v2:{getFilterString(convertServerConfigurationToFilter(config))}">View</Button>
				</div>
			</Card>
			{/each}
		</div>

		<h2 class="text-2xl font-bold mb-6 text-center text-gray-800">Cheapest by Memory</h2>
		<div class="grid grid-cols-2 gap-6 md:grid-cols-4 mb-10">
			{#each cheapRamConfigurations as config}
			<Card class="text-left mb-6">
				<h5 class="mb-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{config.cpu}</h5>
				<div class="mb-3">
					{#if config.is_ecc}<span><Badge border>ECC</Badge></span>{/if}
					{#if config.hdd_drives.length > 0}<span><Badge border>HDD</Badge></span>{/if}
					{#if config.nvme_drives.length > 0 || config.sata_drives.length > 0}<span><Badge border>SSD</Badge></span>{/if}
					{#if config.with_inic}<span><Badge border>iNIC</Badge></span>{/if}
					{#if config.with_gpu}<span><Badge border>GPU</Badge></span>{/if}
					{#if config.with_rps}<span><Badge border>RPS</Badge></span>{/if}
				</div>
				<p class="font-normal text-gray-700 dark:text-gray-400 leading-tight">
					<FontAwesomeIcon icon={faMemory} class="me-1 w-4" /> {config.ram_size} GB RAM<br/>
					<FontAwesomeIcon icon={faHardDrive} class="me-1 w-4" /> {getFormattedDiskSize(config.hdd_size + config.nvme_size + config.sata_size)} Storage<br/>
				</p>
				<div class="flex justify-between items-center mt-3">
					<span class="text-xl font-bold text-gray-900 dark:text-white">{config.price} € <span class="text-gray-400 text-xs">{(config.price / (config.hdd_size / 1000)).toFixed(2)} € / GB</span></span>
					<Button outline href="/analyze#filter.v2:{getFilterString(convertServerConfigurationToFilter(config))}">View</Button>
				</div>
			</Card>
			{/each}
		</div>

		<h2 class="text-2xl font-bold mb-6 text-center text-gray-800">General Auction Insights</h2>
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
