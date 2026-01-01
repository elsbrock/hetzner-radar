<script lang="ts">
	import { faClock, faGavel } from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { Button } from 'flowbite-svelte';
	import { ArrowRightOutline } from 'flowbite-svelte-icons';
	import ServerPriceChart from '$lib/components/ServerPriceChart.svelte';

	// Sample downtrend price data for demonstration
	const samplePriceData = [
		{
			seen: Date.now() / 1000 - 30 * 24 * 60 * 60,
			min_price: 45,
			max_price: 48,
			mean_price: 46.5,
			count: 15
		},
		{
			seen: Date.now() / 1000 - 25 * 24 * 60 * 60,
			min_price: 42,
			max_price: 45,
			mean_price: 43.5,
			count: 18
		},
		{
			seen: Date.now() / 1000 - 20 * 24 * 60 * 60,
			min_price: 38,
			max_price: 41,
			mean_price: 39.5,
			count: 16
		},
		{
			seen: Date.now() / 1000 - 15 * 24 * 60 * 60,
			min_price: 35,
			max_price: 38,
			mean_price: 36.5,
			count: 19
		},
		{
			seen: Date.now() / 1000 - 10 * 24 * 60 * 60,
			min_price: 32,
			max_price: 35,
			mean_price: 33.5,
			count: 17
		},
		{
			seen: Date.now() / 1000 - 8 * 24 * 60 * 60,
			min_price: 36,
			max_price: 39,
			mean_price: 37.5,
			count: 14
		},
		{
			seen: Date.now() / 1000 - 5 * 24 * 60 * 60,
			min_price: 29,
			max_price: 32,
			mean_price: 30.5,
			count: 16
		},
		{
			seen: Date.now() / 1000 - 2 * 24 * 60 * 60,
			min_price: 28,
			max_price: 31,
			mean_price: 29.5,
			count: 18
		}
	];
</script>

<section id="how-it-works" class="mx-auto my-20 max-w-7xl">
	<h2 class="mb-4 text-center text-4xl font-semibold text-gray-800 dark:text-gray-100">
		How It Works
	</h2>
	<p class="mx-auto mb-12 text-center text-gray-600 md:w-2/3 dark:text-gray-400">
		Find servers matching your requirements, review historical pricing, and set up alerts.
	</p>

	<div class="grid grid-cols-1 gap-8 md:grid-cols-3">
		<!-- Step 1 -->
		<div class="relative">
			<div
				class="h-full rounded-lg border border-gray-100 bg-gradient-to-br from-orange-50 to-orange-100 p-6 shadow-sm dark:border-gray-700 dark:from-gray-800 dark:to-gray-700"
			>
				<div class="mb-4 flex items-center">
					<div
						class="mr-4 flex h-10 w-10 items-center justify-center rounded-full bg-orange-500 text-lg font-bold text-white"
					>
						1
					</div>
					<h3 class="text-xl font-bold text-gray-800 dark:text-gray-100">Filter</h3>
				</div>
				<p class="mb-4 text-gray-600 dark:text-gray-400">
					Specify your requirements: CPU type, RAM size, storage configuration, and datacenter
					location.
				</p>
				<div
					class="rounded border border-gray-200 bg-white p-3 dark:border-gray-600 dark:bg-gray-800"
				>
					<div class="flex flex-wrap gap-1.5">
						<span
							class="inline-flex items-center rounded-full border border-orange-200 bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800 dark:border-orange-700 dark:bg-orange-900 dark:text-orange-200"
						>
							CPU: i7+
						</span>
						<span
							class="inline-flex items-center rounded-full border border-orange-200 bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800 dark:border-orange-700 dark:bg-orange-900 dark:text-orange-200"
						>
							RAM: 32GB+
						</span>
						<span
							class="inline-flex items-center rounded-full border border-orange-200 bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800 dark:border-orange-700 dark:bg-orange-900 dark:text-orange-200"
						>
							NVMe: SSD
						</span>
					</div>
				</div>
			</div>
		</div>

		<!-- Step 2 -->
		<div class="relative">
			<div
				class="h-full rounded-lg border border-gray-100 bg-gradient-to-br from-purple-50 to-purple-100 p-6 shadow-sm dark:border-gray-700 dark:from-gray-800 dark:to-gray-700"
			>
				<div class="mb-4 flex items-center">
					<div
						class="mr-4 flex h-10 w-10 items-center justify-center rounded-full bg-purple-500 text-lg font-bold text-white"
					>
						2
					</div>
					<h3 class="text-xl font-bold text-gray-800 dark:text-gray-100">Compare</h3>
				</div>
				<p class="mb-4 text-gray-600 dark:text-gray-400">
					Review price history to understand typical pricing for your desired configuration.
				</p>
				<div class="rounded border border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-800">
					<div class="h-28">
						<ServerPriceChart
							data={samplePriceData}
							loading={false}
							legendShow={false}
							tooltipShow={false}
						/>
					</div>
				</div>
			</div>
		</div>

		<!-- Step 3 -->
		<div class="relative">
			<div
				class="h-full rounded-lg border border-gray-100 bg-gradient-to-br from-blue-50 to-blue-100 p-6 shadow-sm dark:border-gray-700 dark:from-gray-800 dark:to-gray-700"
			>
				<div class="mb-4 flex items-center">
					<div
						class="mr-4 flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 text-lg font-bold text-white"
					>
						3
					</div>
					<h3 class="text-xl font-bold text-gray-800 dark:text-gray-100">Set Alerts</h3>
				</div>
				<p class="mb-4 text-gray-600 dark:text-gray-400">
					Create alerts for price thresholds or cloud availability. Get notified via email or
					Discord.
				</p>
				<div class="space-y-3">
					<div
						class="flex items-center gap-2 rounded-lg border border-l-3 border-orange-200 border-l-orange-500 bg-orange-50 p-2 dark:border-orange-700 dark:bg-orange-900/20"
					>
						<FontAwesomeIcon icon={faGavel} class="h-3 w-3 flex-shrink-0 text-orange-500" />
						<div class="min-w-0 flex-1">
							<div class="truncate text-xs font-medium text-gray-800 dark:text-gray-200">
								Auction Alert
							</div>
							<div class="truncate text-xs text-gray-600 dark:text-gray-400">Target: ≤ €25</div>
						</div>
						<div class="h-2 w-2 flex-shrink-0 rounded-full bg-green-500"></div>
					</div>
					<div
						class="flex items-center gap-2 rounded-lg border border-l-3 border-blue-200 border-l-blue-500 bg-blue-50 p-2 dark:border-blue-700 dark:bg-blue-900/20"
					>
						<FontAwesomeIcon icon={faClock} class="h-3 w-3 flex-shrink-0 text-blue-500" />
						<div class="min-w-0 flex-1">
							<div class="truncate text-xs font-medium text-gray-800 dark:text-gray-200">
								Cloud Alert
							</div>
							<div class="truncate text-xs text-gray-600 dark:text-gray-400">CAX41 in FSN</div>
						</div>
						<div class="h-2 w-2 flex-shrink-0 rounded-full bg-yellow-500"></div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Call to action -->
	<div class="mt-12 text-center">
		<Button href="/analyze" size="lg" color="primary">
			Browse Servers
			<ArrowRightOutline class="ms-2 h-5 w-5" />
		</Button>
	</div>
</section>
