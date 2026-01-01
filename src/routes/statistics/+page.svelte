<script lang="ts">
	import { withDbConnections } from '$lib/api/frontend/dbapi';
	import {
		getCPUVendorPriceStats,
		getDatacenterList,
		getDiskPriceStats,
		getGPUPriceStats,
		getPriceIndexStats,
		getRamPriceStats,
		getVolumeByCPUModelStats,
		getVolumeByCPUVendorStats,
		getVolumeByDatacenterStats,
		getVolumeStats,
		getSoldAuctionPriceStats,
		type TemporalStat
	} from '$lib/api/frontend/stats';
	import GenericChart from '$lib/components/GenericChart.svelte';
	import QuickStat from '$lib/components/QuickStat.svelte';
	import type { AsyncDuckDB } from '@duckdb/duckdb-wasm';
	import {
		faArrowDown,
		faArrowUp,
		faChartLine,
		faHdd,
		faMemory,
		faMicrochip,
		faServer
	} from '@fortawesome/free-solid-svg-icons';
	import { db } from '../../stores/db';
	import { currencySymbol, currentCurrency } from '$lib/stores/settings';
	import { convertPrice } from '$lib/currency';

	let _loading = $state(true);

	let dailyPriceIndexStats = $state<TemporalStat[]>([]);
	let ramWithECCPriceStats = $state<TemporalStat[]>([]);
	let ramWithoutECCPriceStats = $state<TemporalStat[]>([]);
	let hddPriceStats = $state<TemporalStat[]>([]);
	let nvmePriceStats = $state<TemporalStat[]>([]);
	let sataPriceStats = $state<TemporalStat[]>([]);
	let _gpuPriceStats = $state<TemporalStat[]>([]);
	let cpuVendorAMDStats = $state<TemporalStat[]>([]);
	let cpuVendorIntelStats = $state<TemporalStat[]>([]);
	let volumeFinlandStats = $state<TemporalStat[]>([]);
	let volumeGermanyStats = $state<TemporalStat[]>([]);

	// New state variables for the additional charts
	let volumeAMDStats = $state<TemporalStat[]>([]);
	let volumeIntelStats = $state<TemporalStat[]>([]);
	let soldAuctionPriceStats = $state<TemporalStat[]>([]);

	// CPU model volume stats
	let intelCPUModelStats = $state<{ [model: string]: TemporalStat[] }>({});
	let amdCPUModelStats = $state<{ [model: string]: TemporalStat[] }>({});

	// Datacenter volume stats by country
	let finlandDatacenters = $state<string[]>([]);
	let germanyDatacenters = $state<string[]>([]);

	// Datacenter volume stats by country
	let datacenterVolumeFinlandStats = $state<{
		[datacenter: string]: TemporalStat[];
	}>({});
	let datacenterVolumeGermanyStats = $state<{
		[datacenter: string]: TemporalStat[];
	}>({});

	// Derived values for quick stats
	let currentPriceIndex = $derived(
		dailyPriceIndexStats.length > 0 ? dailyPriceIndexStats[dailyPriceIndexStats.length - 1].y : null
	);

	let priceIndexTrend = $derived(
		dailyPriceIndexStats.length >= 30
			? (() => {
					const currentIndex = dailyPriceIndexStats[dailyPriceIndexStats.length - 1].y;
					const thirtyDaysAgoIndex = dailyPriceIndexStats[dailyPriceIndexStats.length - 30].y;

					return thirtyDaysAgoIndex === 0
						? null
						: ((currentIndex - thirtyDaysAgoIndex) / thirtyDaysAgoIndex) * 100;
				})()
			: null
	);

	let isPriceRising = $derived(priceIndexTrend !== null && priceIndexTrend > 0);

	// New derived values for additional quick stats

	// 1. Lowest current server price
	let lowestServerPrice = $derived(
		cpuVendorAMDStats.length > 0 && cpuVendorIntelStats.length > 0
			? Math.min(
					cpuVendorAMDStats[cpuVendorAMDStats.length - 1]?.y || Infinity,
					cpuVendorIntelStats[cpuVendorIntelStats.length - 1]?.y || Infinity
				)
			: null
	);

	// 2. AMD vs Intel price comparison
	let amdVsIntelPrice = $derived(
		cpuVendorAMDStats.length > 0 && cpuVendorIntelStats.length > 0
			? {
					amd: cpuVendorAMDStats[cpuVendorAMDStats.length - 1]?.y,
					intel: cpuVendorIntelStats[cpuVendorIntelStats.length - 1]?.y,
					difference: (
						((cpuVendorAMDStats[cpuVendorAMDStats.length - 1]?.y -
							cpuVendorIntelStats[cpuVendorIntelStats.length - 1]?.y) /
							cpuVendorIntelStats[cpuVendorIntelStats.length - 1]?.y) *
						100
					).toFixed(1)
				}
			: null
	);

	// 3. RAM price comparison (ECC vs non-ECC)
	let ramPriceComparison = $derived(
		ramWithECCPriceStats.length > 0 && ramWithoutECCPriceStats.length > 0
			? {
					withECC: ramWithECCPriceStats[ramWithECCPriceStats.length - 1]?.y,
					withoutECC: ramWithoutECCPriceStats[ramWithoutECCPriceStats.length - 1]?.y,
					difference: (
						((ramWithECCPriceStats[ramWithECCPriceStats.length - 1]?.y -
							ramWithoutECCPriceStats[ramWithoutECCPriceStats.length - 1]?.y) /
							ramWithoutECCPriceStats[ramWithoutECCPriceStats.length - 1]?.y) *
						100
					).toFixed(1)
				}
			: null
	);

	// 4. Storage price comparison (NVMe vs HDD)
	let storagePriceComparison = $derived(
		nvmePriceStats.length > 0 && hddPriceStats.length > 0
			? {
					nvme: nvmePriceStats[nvmePriceStats.length - 1]?.y,
					hdd: hddPriceStats[hddPriceStats.length - 1]?.y,
					ratio: (
						nvmePriceStats[nvmePriceStats.length - 1]?.y /
						hddPriceStats[hddPriceStats.length - 1]?.y
					).toFixed(1)
				}
			: null
	);

	async function fetchData(db: AsyncDuckDB) {
		let queryTime = performance.now();
		_loading = true;

		await withDbConnections(db, async (conn1, conn2, conn3, conn4, conn5) => {
			try {
				// Get the list of datacenters for each country
				finlandDatacenters = await getDatacenterList(conn1, 'Finland');
				germanyDatacenters = await getDatacenterList(conn2, 'Germany');

				// Fetch datacenter volume stats for Finland datacenters
				const datacenterFinlandPromises = finlandDatacenters.map((dc) =>
					getVolumeByDatacenterStats(conn3, dc, 'Finland').then((stats) => [dc, stats])
				);

				// Fetch datacenter volume stats for Germany datacenters
				const datacenterGermanyPromises = germanyDatacenters.map((dc) =>
					getVolumeByDatacenterStats(conn4, dc, 'Germany').then((stats) => [dc, stats])
				);

				const [datacenterFinlandResults, datacenterGermanyResults] = await Promise.all([
					Promise.all(datacenterFinlandPromises),
					Promise.all(datacenterGermanyPromises)
				]);

				// Convert results to objects
				datacenterVolumeFinlandStats = Object.fromEntries(datacenterFinlandResults);
				datacenterVolumeGermanyStats = Object.fromEntries(datacenterGermanyResults);

				// Fetch basic stats
				[
					dailyPriceIndexStats,
					ramWithECCPriceStats,
					ramWithoutECCPriceStats,
					hddPriceStats,
					nvmePriceStats,
					sataPriceStats,
					_gpuPriceStats,
					cpuVendorAMDStats,
					cpuVendorIntelStats,
					volumeFinlandStats,
					volumeGermanyStats,
					volumeAMDStats,
					volumeIntelStats,
					soldAuctionPriceStats
				] = await Promise.all([
					getPriceIndexStats(conn1),
					getRamPriceStats(conn2, true),
					getRamPriceStats(conn3, false),
					getDiskPriceStats(conn4, 'hdd'),
					getDiskPriceStats(conn5, 'nvme'),
					getDiskPriceStats(conn1, 'sata'),
					getGPUPriceStats(conn1),
					getCPUVendorPriceStats(conn2, 'AMD'),
					getCPUVendorPriceStats(conn2, 'Intel'),
					getVolumeStats(conn3, 'Finland'),
					getVolumeStats(conn3, 'Germany'),
					getVolumeByCPUVendorStats(conn4, 'AMD'),
					getVolumeByCPUVendorStats(conn4, 'Intel'),
					getSoldAuctionPriceStats(conn1)
				]);

				// Fetch CPU model volume stats (top 7 models for each vendor)
				[intelCPUModelStats, amdCPUModelStats] = await Promise.all([
					getVolumeByCPUModelStats(conn5, 'Intel', undefined, 7),
					getVolumeByCPUModelStats(conn5, 'AMD', undefined, 7)
				]);

				// This section is no longer needed as we're now showing datacenter volumes by country
				// instead of overall datacenter volumes

				// No longer needed

				queryTime = performance.now() - queryTime;
			} catch (error) {
				console.error('Error fetching data:', error);
			} finally {
				_loading = false;
			}
		});
	}

	$effect(() => {
		if ($db) {
			fetchData($db);
		}
	});
</script>

<div class="p-8">
	<section class="mx-auto my-12 max-w-7xl text-center">
		<h1 class="mb-6 text-5xl font-extrabold text-gray-800 dark:text-gray-100">
			Dive into our Auction Statistics
		</h1>
		<p class="mb-10 text-lg text-gray-600 dark:text-gray-400">
			Explore comprehensive insights into server availability, pricing trends, and configuration
			distributions to optimize your infrastructure investments.
		</p>
	</section>

	<!-- Quick Stats Section -->
	<section class="mx-auto mb-12 max-w-7xl">
		<h2 class="mb-4 text-2xl font-bold text-gray-800 dark:text-gray-100">
			Key Metrics at a Glance
		</h2>
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
			<!-- Current Price Index -->
			<QuickStat
				icon={faChartLine}
				title="Price Index"
				value={currentPriceIndex !== null ? currentPriceIndex.toFixed(3) : null}
				subtitle="Values > 1.0 = higher prices"
			/>

			<!-- 30-Day Price Trend -->
			<QuickStat
				icon={isPriceRising ? faArrowUp : faArrowDown}
				title="30-Day Trend"
				value={priceIndexTrend !== null
					? `${isPriceRising ? '+' : ''}${priceIndexTrend.toFixed(2)}%`
					: null}
				valueClass={isPriceRising ? 'text-red-500' : 'text-green-500'}
				subtitle={`Prices ${isPriceRising ? 'rising' : 'falling'} vs 30 days ago`}
			/>

			<!-- Lowest Server Price -->
			<QuickStat
				icon={faServer}
				title="Lowest Price"
				value={lowestServerPrice !== null ? `${$currencySymbol}${convertPrice(lowestServerPrice, 'EUR', $currentCurrency).toFixed(2)}` : null}
				subtitle="Cheapest server available"
			/>

			<!-- AMD vs Intel Price -->
			<QuickStat
				icon={faMicrochip}
				title="AMD vs Intel"
				value={amdVsIntelPrice !== null ? `${amdVsIntelPrice.difference}%` : null}
				subtitle={`AMD ${amdVsIntelPrice !== null && parseFloat(amdVsIntelPrice.difference) < 0 ? 'cheaper' : 'pricier'} than Intel`}
			/>

			<!-- RAM Price Comparison -->
			<QuickStat
				icon={faMemory}
				title="ECC Premium"
				value={ramPriceComparison !== null
					? `${parseFloat(ramPriceComparison.difference) * -1}%`
					: null}
				subtitle="ECC RAM cost markup per GB"
			/>

			<!-- Storage Price Comparison -->
			<QuickStat
				icon={faHdd}
				title="NVMe vs HDD"
				value={storagePriceComparison !== null ? `${storagePriceComparison.ratio}x` : null}
				subtitle="NVMe premium per TB"
			/>
		</div>
	</section>

	<!-- Price Index Section -->
	<section class="mx-auto my-12 max-w-7xl">
		<h2 class="mb-4 text-2xl font-bold text-gray-800 dark:text-gray-100">Price Index</h2>
		<div class="my-6 overflow-hidden rounded-lg bg-white shadow-md dark:bg-gray-800">
			<div class="p-6">
				<h3 class="text-xl font-bold text-gray-900 dark:text-white">Overall Price Index</h3>
				<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
					The Overall Price Index represents the relative trend of server prices over time,
					calculated using the lowest auction price for each configuration category on a daily
					basis. It compares daily prices to a 90-day median baseline for similar configurations,
					providing insight into whether the market is currently cheap, average, or expensive.
				</p>
				<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
					An index value close to 1.0 indicates median market prices. Values above 1.0 suggest that
					servers are currently more expensive than the median, while values below 1.0 indicate
					lower-than-median prices. This index can both increase and decrease based on actual market
					conditions, allowing you to identify the best times to purchase servers.
				</p>
			</div>
			<div class="h-80 w-full">
				<GenericChart
					type="line"
					data={[{ name: 'Price Index', data: dailyPriceIndexStats }]}
					options={{
						scales: {
							y: {
								title: {
									display: true,
									text: 'Index'
								},
								ticks: {
									callback: function (tickValue: number | string) {
										if (typeof tickValue === 'number') {
											return tickValue.toFixed(3);
										}
										return tickValue;
									}
								}
							}
						}
					}}
				/>
			</div>
		</div>
		<!-- Price Statistics Section -->
		<section class="mt-12">
			<h2 class="mb-4 text-2xl font-bold text-gray-800 dark:text-gray-100">Price Statistics</h2>
			<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
				<!-- RAM Price Over Time -->
				<div class="overflow-hidden rounded-lg bg-white shadow-md dark:bg-gray-800">
					<div class="p-6">
						<h3 class="text-xl font-bold text-gray-900 dark:text-white">RAM Price Over Time</h3>
						<p class="mt-2 text-base text-gray-600 dark:text-gray-400">
							Track the price trends for RAM over time. Use this to gauge when it's most
							cost-effective to invest in memory-intensive servers.
						</p>
					</div>
					<div class="h-80 w-full">
						<GenericChart
							type="line"
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
						<p class="mt-2 text-base text-gray-600 dark:text-gray-400">
							Explore how the price of one GB HDD storage has fluctuated over time. This data can
							help you determine the best time to purchase storage-heavy configurations.
						</p>
					</div>
					<div class="h-80 w-full">
						<GenericChart type="line" data={[{ name: 'HDD Price', data: hddPriceStats }]} />
					</div>
				</div>

				<!-- SSD Price Over Time -->
				<div class="overflow-hidden rounded-lg bg-white shadow-md dark:bg-gray-800">
					<div class="p-6">
						<h3 class="text-xl font-bold text-gray-900 dark:text-white">SSD Price Over Time</h3>
						<p class="mt-2 text-base text-gray-600 dark:text-gray-400">
							See how one GB of SSD storage have changed over time, allowing you to plan your
							purchases for configurations that rely on fast storage solutions.
						</p>
					</div>
					<div class="h-80 w-full">
						<GenericChart
							type="line"
							data={[
								{ name: 'NVMe', data: nvmePriceStats },
								{ name: 'SATA', data: sataPriceStats }
							]}
						/>
					</div>
				</div>

				<!-- Average Sold Auction Price (Daily) -->
				<div class="overflow-hidden rounded-lg bg-white shadow-md dark:bg-gray-800">
					<div class="p-6">
						<h3 class="text-xl font-bold text-gray-900 dark:text-white">
							Average Sold Auction Price (Daily)
						</h3>
						<p class="mt-2 text-base text-gray-600 dark:text-gray-400">
							Tracks the average daily price of server auctions that have been sold (latest price
							entry, excluding fixed-price offers). This helps understand actual market transaction
							values.
						</p>
					</div>
					<div class="h-80 w-full">
						<GenericChart
							data={[{ name: 'Avg. Sold Auction Price', data: soldAuctionPriceStats }]}
						/>
					</div>
				</div>
			</div>
		</section>

		<!-- Volume Statistics Section -->
		<section class="mt-12">
			<h2 class="mb-4 text-2xl font-bold text-gray-800 dark:text-gray-100">Volume Statistics</h2>
			<div class="grid grid-cols-1 gap-6">
				<!-- Volume by Country -->
				<div class="overflow-hidden rounded-lg bg-white shadow-md dark:bg-gray-800">
					<div class="p-6">
						<h3 class="text-xl font-bold text-gray-900 dark:text-white">Volume by Country</h3>
						<p class="mt-2 text-base text-gray-600 dark:text-gray-400">
							Analyze the volume of servers deployed in different regions to identify trends and
							make informed decisions about where to expand your infrastructure.
						</p>
					</div>
					<div class="h-80 w-full">
						<GenericChart
							type="line"
							data={[
								{ name: 'Finland', data: volumeFinlandStats, fill: true },
								{ name: 'Germany', data: volumeGermanyStats, fill: true }
							]}
							options={{
								scales: {
									y: {
										stacked: true,
										title: {
											display: true,
											text: 'Volume'
										},
										ticks: {
											callback: function (tickValue: number | string) {
												if (typeof tickValue === 'number') {
													return tickValue.toFixed(0);
												}
												return tickValue;
											}
										}
									},
									x: {
										stacked: true
									}
								},
								plugins: {
									tooltip: {
										mode: 'index'
									}
								}
							}}
						/>
					</div>
				</div>

				<!-- Volume by Datacenter - Finland -->
				<div class="overflow-hidden rounded-lg bg-white shadow-md dark:bg-gray-800">
					<div class="p-6">
						<h3 class="text-xl font-bold text-gray-900 dark:text-white">
							Volume by Datacenter - Finland
						</h3>
						<p class="mt-2 text-base text-gray-600 dark:text-gray-400">
							Compare server volume across different datacenters in Finland to identify availability
							patterns and make informed decisions about where to deploy your infrastructure.
						</p>
					</div>
					<div class="h-80 w-full">
						<GenericChart
							type="line"
							data={finlandDatacenters.map((dc) => ({
								name: dc,
								data: datacenterVolumeFinlandStats[dc] || [],
								fill: true
							}))}
							options={{
								plugins: {
									tooltip: {
										mode: 'index'
									},
									legend: {
										align: 'start',
										labels: {
											boxWidth: 15,
											padding: 10,
											font: {
												size: 11
											}
										},
										maxHeight: 250,
										display: true
									}
								},
								scales: {
									y: {
										stacked: true,
										title: {
											display: true,
											text: 'Available Servers'
										},
										ticks: {
											callback: function (tickValue: number | string) {
												if (typeof tickValue === 'number') {
													return tickValue.toFixed(0);
												}
												return tickValue;
											}
										}
									},
									x: {
										stacked: true
									}
								}
							}}
						/>
					</div>
				</div>

				<!-- Volume by Datacenter - Germany -->
				<div class="overflow-hidden rounded-lg bg-white shadow-md dark:bg-gray-800">
					<div class="p-6">
						<h3 class="text-xl font-bold text-gray-900 dark:text-white">
							Volume by Datacenter - Germany
						</h3>
						<p class="mt-2 text-base text-gray-600 dark:text-gray-400">
							Compare server volume across different datacenters in Germany to identify availability
							patterns and make informed decisions about where to deploy your infrastructure.
						</p>
					</div>
					<div class="h-80 w-full">
						<GenericChart
							type="line"
							data={germanyDatacenters.map((dc) => ({
								name: dc,
								data: datacenterVolumeGermanyStats[dc] || [],
								fill: true
							}))}
							options={{
								plugins: {
									tooltip: {
										mode: 'index'
									},
									legend: {
										align: 'start',
										labels: {
											boxWidth: 15,
											padding: 10,
											font: {
												size: 11
											}
										},
										maxHeight: 250,
										display: true
									}
								},
								scales: {
									y: {
										stacked: true,
										title: {
											display: true,
											text: 'Available Servers'
										},
										ticks: {
											callback: function (tickValue: number | string) {
												if (typeof tickValue === 'number') {
													return tickValue.toFixed(0);
												}
												return tickValue;
											}
										}
									},
									x: {
										stacked: true
									}
								}
							}}
						/>
					</div>
				</div>
			</div>

			<div class="mt-6 grid grid-cols-1 gap-6">
				<!-- Volume Intel vs. AMD -->
				<div class="overflow-hidden rounded-lg bg-white shadow-md dark:bg-gray-800">
					<div class="p-6">
						<h3 class="text-xl font-bold text-gray-900 dark:text-white">Volume Intel vs. AMD</h3>
						<p class="mt-2 text-base text-gray-600 dark:text-gray-400">
							Compare the volume of servers with Intel and AMD processors to understand market
							trends and availability patterns for different CPU architectures.
						</p>
					</div>
					<div class="h-80 w-full">
						<GenericChart
							type="line"
							data={[
								{ name: 'AMD', data: volumeAMDStats, fill: true },
								{ name: 'Intel', data: volumeIntelStats, fill: true }
							]}
							options={{
								scales: {
									y: {
										stacked: true,
										title: {
											display: true,
											text: 'Available Servers'
										},
										ticks: {
											callback: function (tickValue: number | string) {
												if (typeof tickValue === 'number') {
													return tickValue.toFixed(0);
												}
												return tickValue;
											}
										}
									},
									x: {
										stacked: true
									}
								},
								plugins: {
									tooltip: {
										mode: 'index'
									}
								}
							}}
						/>
					</div>
				</div>
			</div>
		</section>

		<!-- CPU Statistics Section -->
		<section class="mt-12">
			<h2 class="mb-4 text-2xl font-bold text-gray-800 dark:text-gray-100">CPU Statistics</h2>
			<div class="grid grid-cols-1 gap-6">
				<!-- Volume by Intel CPU Models -->
				<div class="overflow-hidden rounded-lg bg-white shadow-md dark:bg-gray-800">
					<div class="p-6">
						<h3 class="text-xl font-bold text-gray-900 dark:text-white">
							Volume by Intel CPU Models
						</h3>
						<p class="mt-2 text-base text-gray-600 dark:text-gray-400">
							Compare the volume of servers with different Intel CPU models to identify which models
							are most commonly available in the auction marketplace.
						</p>
					</div>
					<div class="h-80 w-full">
						<GenericChart
							type="line"
							data={Object.entries(intelCPUModelStats).map(([model, stats]) => ({
								name: model,
								data: stats,
								fill: true
							}))}
							options={{
								scales: {
									y: {
										stacked: true,
										title: {
											display: true,
											text: 'Available Servers'
										},
										ticks: {
											callback: function (tickValue: number | string) {
												if (typeof tickValue === 'number') {
													return tickValue.toFixed(0);
												}
												return tickValue;
											}
										}
									},
									x: {
										stacked: true
									}
								},
								plugins: {
									legend: {
										align: 'start',
										labels: {
											boxWidth: 15,
											padding: 10,
											font: {
												size: 11
											}
										},
										maxHeight: 250,
										display: true
									},
									tooltip: {
										mode: 'index'
									}
								}
							}}
						/>
					</div>
				</div>
			</div>

			<div class="mt-6 grid grid-cols-1 gap-6">
				<!-- Volume by AMD CPU Models -->
				<div class="overflow-hidden rounded-lg bg-white shadow-md dark:bg-gray-800">
					<div class="p-6">
						<h3 class="text-xl font-bold text-gray-900 dark:text-white">
							Volume by AMD CPU Models
						</h3>
						<p class="mt-2 text-base text-gray-600 dark:text-gray-400">
							Compare the volume of servers with different AMD CPU models to identify which models
							are most commonly available in the auction marketplace.
						</p>
					</div>
					<div class="h-80 w-full">
						<GenericChart
							type="line"
							data={Object.entries(amdCPUModelStats).map(([model, stats]) => ({
								name: model,
								data: stats,
								fill: true
							}))}
							options={{
								scales: {
									y: {
										stacked: true,
										title: {
											display: true,
											text: 'Available Servers'
										},
										ticks: {
											callback: function (tickValue: number | string) {
												if (typeof tickValue === 'number') {
													return tickValue.toFixed(0);
												}
												return tickValue;
											}
										}
									},
									x: {
										stacked: true
									}
								},
								plugins: {
									legend: {
										align: 'start',
										labels: {
											boxWidth: 15,
											padding: 10,
											font: {
												size: 11
											}
										},
										maxHeight: 250,
										display: true
									},
									tooltip: {
										mode: 'index'
									}
								}
							}}
						/>
					</div>
				</div>
			</div>
		</section>
	</section>
</div>
