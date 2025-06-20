<script lang="ts">
	import { faGithub } from '@fortawesome/free-brands-svg-icons';
	import {
		faBell,
		faChartLine,
		faChevronLeft,
		faClock,
		faFilter,
		faForwardStep,
		faGavel,
		faGlobe,
		faHardDrive,
		faMemory,
		faMicrochip,
		faServer,
		faUsers
	} from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { Button } from 'flowbite-svelte';
	import { ArrowRightOutline } from 'flowbite-svelte-icons';
	import ServerPriceChart from '../ServerPriceChart.svelte';
	import type { ServerPriceStat } from '$lib/api/frontend/filter';

	// Sample data showing a falling price trend over time
	const now = Math.floor(Date.now() / 1000);
	const oneDay = 24 * 60 * 60;

	const samplePriceData: ServerPriceStat[] = [
		{ seen: now - 30 * oneDay, min_price: 32.0, max_price: 34.0, mean_price: 33.0, count: 3 },
		{ seen: now - 25 * oneDay, min_price: 31.5, max_price: 33.5, mean_price: 32.5, count: 4 },
		{ seen: now - 20 * oneDay, min_price: 30.8, max_price: 32.8, mean_price: 31.8, count: 2 },
		{ seen: now - 18 * oneDay, min_price: 30.2, max_price: 32.2, mean_price: 31.2, count: 5 },
		{ seen: now - 15 * oneDay, min_price: 29.5, max_price: 31.5, mean_price: 30.5, count: 3 },
		{ seen: now - 12 * oneDay, min_price: 28.9, max_price: 30.9, mean_price: 29.9, count: 4 },
		{ seen: now - 10 * oneDay, min_price: 28.2, max_price: 30.2, mean_price: 29.2, count: 2 },
		{ seen: now - 8 * oneDay, min_price: 27.8, max_price: 29.8, mean_price: 28.8, count: 6 },
		{ seen: now - 5 * oneDay, min_price: 27.1, max_price: 29.1, mean_price: 28.1, count: 3 },
		{ seen: now - 3 * oneDay, min_price: 26.5, max_price: 28.5, mean_price: 27.5, count: 4 },
		{ seen: now - 1 * oneDay, min_price: 26.0, max_price: 28.0, mean_price: 27.0, count: 2 }
	];
</script>

<section id="features" class="mx-auto mb-20 max-w-7xl">
	<h2 class="mb-4 text-center text-4xl font-semibold text-gray-800 dark:text-gray-100">
		Powerful Features for Smart Server Hunting
	</h2>
	<p class="mx-auto mb-12 text-center text-gray-600 md:w-2/3 dark:text-gray-400">
		Everything you need to find the perfect server at the right price. Built by the community,
		refined through real-world use, and completely free forever.
	</p>

	<!-- Two-column feature grid with alternating layout -->
	<div class="space-y-16">
		<!-- Feature 1: Price Tracking -->
		<div class="grid grid-cols-1 items-center gap-8 lg:grid-cols-2">
			<div class="order-2 lg:order-1">
				<div
					class="rounded-lg border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gradient-to-br dark:from-gray-800 dark:to-gray-700"
				>
					<h3
						class="mb-3 flex items-center gap-3 text-2xl font-bold text-gray-800 dark:text-gray-100"
					>
						<FontAwesomeIcon class="h-8 w-8 text-orange-500" icon={faChartLine} />
						Historical Price Intelligence
					</h3>
					<p class="mb-4 text-gray-600 dark:text-gray-400">
						Track price trends over time for any server configuration. Our comprehensive 3-month
						history helps you understand market patterns and identify the best times to buy.
					</p>
					<ul class="space-y-2 text-sm text-gray-600 dark:text-gray-400">
						<li class="flex items-center gap-2">
							<span class="text-orange-500">✓</span>
							Interactive price charts with zoom and pan
						</li>
						<li class="flex items-center gap-2">
							<span class="text-orange-500">✓</span>
							Compare multiple configurations side-by-side
						</li>
						<li class="flex items-center gap-2">
							<span class="text-orange-500">✓</span>
							Export data for your own analysis
						</li>
					</ul>
				</div>
			</div>
			<div class="order-1 lg:order-2">
				<div
					class="relative mx-12 h-52 overflow-hidden rounded-lg border border-gray-200 bg-white p-4 shadow dark:border-gray-700 dark:bg-gray-800"
				>
					<!-- Real ServerPriceChart component with sample falling price data -->
					<ServerPriceChart
						data={samplePriceData}
						loading={false}
						toolbarShow={false}
						legendShow={true}
						tooltipShow={false}
						timeUnitPrice="perMonth"
					/>
					<!-- Subtle overlay to indicate this is a demo -->
					<div
						class="pointer-events-none absolute inset-0 bg-gradient-to-t from-white/80 via-transparent to-transparent dark:from-gray-900/80"
					></div>
				</div>
			</div>
		</div>

		<!-- Feature 2: Advanced Filtering -->
		<div class="grid grid-cols-1 items-center gap-8 lg:grid-cols-2">
			<div>
				<div
					class="relative mx-auto max-w-sm overflow-hidden rounded-lg border border-gray-200 bg-white shadow dark:border-gray-700 dark:bg-gray-800"
				>
					<!-- Mock filter interface that looks like actual ServerFilter -->
					<div class="h-80 space-y-3 overflow-hidden p-4">
						<!-- Filter header -->
						<div
							class="flex items-center justify-between border-b border-gray-200 pb-2 dark:border-gray-700"
						>
							<h3 class="text-lg font-medium text-gray-800 dark:text-white">Filter Settings</h3>
							<FontAwesomeIcon icon={faChevronLeft} class="h-4 w-4 text-gray-400" />
						</div>

						<!-- Location section -->
						<div class="space-y-2">
							<h4 class="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
								<FontAwesomeIcon class="me-2 h-4 w-4" icon={faGlobe} />Location
							</h4>
							<div class="space-y-1">
								<div class="flex items-center gap-2">
									<div class="h-4 w-4 rounded bg-purple-500"></div>
									<span class="text-sm text-gray-600 dark:text-gray-400">Germany</span>
								</div>
								<div class="flex items-center gap-2">
									<div class="h-4 w-4 rounded border-2 border-gray-300 dark:border-gray-600"></div>
									<span class="text-sm text-gray-600 dark:text-gray-400">Finland</span>
								</div>
							</div>
						</div>

						<!-- CPU section -->
						<div class="space-y-2">
							<h4 class="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
								<FontAwesomeIcon class="me-2 h-4 w-4" icon={faMicrochip} />CPU
							</h4>
							<div class="space-y-1">
								<span class="text-xs text-gray-500 dark:text-gray-400">Vendor</span>
								<div class="flex items-center gap-2">
									<div class="h-4 w-4 rounded bg-purple-500"></div>
									<span class="text-sm text-gray-600 dark:text-gray-400">Intel</span>
								</div>
							</div>
						</div>

						<!-- Memory section with range slider -->
						<div class="space-y-2">
							<h4 class="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
								<FontAwesomeIcon class="me-2 h-4 w-4" icon={faMemory} />Memory
							</h4>
							<div class="flex justify-between text-xs text-gray-500 dark:text-gray-400">
								<span>Size</span>
								<span>32GB – 64GB</span>
							</div>
							<!-- Range slider mockup -->
							<div class="relative">
								<div class="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
									<div
										class="absolute h-2 rounded-full bg-purple-500"
										style="left: 25%; width: 40%"
									></div>
									<div
										class="absolute h-3 w-3 rounded-full border-2 border-white bg-purple-600 shadow-sm"
										style="left: 23%; top: -2px"
									></div>
									<div
										class="absolute h-3 w-3 rounded-full border-2 border-white bg-purple-600 shadow-sm"
										style="left: 63%; top: -2px"
									></div>
								</div>
								<!-- Slider pips -->
								<div class="mt-1 flex justify-between text-xs text-gray-400">
									<span>4GB</span>
									<span>1TB</span>
								</div>
							</div>
							<!-- ECC buttons -->
							<div class="flex items-center justify-between">
								<span class="text-xs text-gray-500 dark:text-gray-400">ECC</span>
								<div class="flex rounded-md shadow-sm">
									<button class="rounded-l-md bg-purple-500 px-2 py-1 text-xs text-white"
										>yes</button
									>
									<button
										class="bg-gray-200 px-2 py-1 text-xs text-gray-700 dark:bg-gray-600 dark:text-gray-300"
										>no</button
									>
									<button
										class="rounded-r-md bg-gray-200 px-2 py-1 text-xs text-gray-700 dark:bg-gray-600 dark:text-gray-300"
										>any</button
									>
								</div>
							</div>
						</div>

						<!-- Disks section -->
						<div class="space-y-2">
							<h4 class="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
								<FontAwesomeIcon class="me-2 h-4 w-4" icon={faHardDrive} />Disks
							</h4>
							<div class="text-xs font-medium text-gray-600 dark:text-gray-400">SSDs (NVMe)</div>
							<div class="flex justify-between text-xs text-gray-500 dark:text-gray-400">
								<span>Devices</span>
								<span>2 – 4</span>
							</div>
							<!-- Another range slider -->
							<div class="relative">
								<div class="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
									<div
										class="absolute h-2 rounded-full bg-purple-500"
										style="left: 30%; width: 35%"
									></div>
									<div
										class="absolute h-3 w-3 rounded-full border-2 border-white bg-purple-600 shadow-sm"
										style="left: 28%; top: -2px"
									></div>
									<div
										class="absolute h-3 w-3 rounded-full border-2 border-white bg-purple-600 shadow-sm"
										style="left: 63%; top: -2px"
									></div>
								</div>
							</div>
						</div>
					</div>

					<!-- Fade out effect -->
					<div
						class="pointer-events-none absolute inset-0 bg-gradient-to-t from-white/80 via-transparent to-transparent dark:from-gray-900/80"
					></div>
					<div
						class="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-white/40 dark:to-gray-900/40"
					></div>
				</div>
			</div>
			<div>
				<div
					class="rounded-lg border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gradient-to-br dark:from-gray-800 dark:to-gray-700"
				>
					<h3
						class="mb-3 flex items-center gap-3 text-2xl font-bold text-gray-800 dark:text-gray-100"
					>
						<FontAwesomeIcon class="h-8 w-8 text-purple-500" icon={faFilter} />
						Precision Filtering Engine
					</h3>
					<p class="mb-4 text-gray-600 dark:text-gray-400">
						Find exactly what you need with our advanced filtering system. Filter by CPU, RAM,
						storage, location, and even specific disk configurations.
					</p>
					<ul class="space-y-2 text-sm text-gray-600 dark:text-gray-400">
						<li class="flex items-center gap-2">
							<span class="text-purple-500">✓</span>
							Dual-range sliders for precise control
						</li>
						<li class="flex items-center gap-2">
							<span class="text-purple-500">✓</span>
							Save and share filter configurations
						</li>
						<li class="flex items-center gap-2">
							<span class="text-purple-500">✓</span>
							Real-time results as you adjust filters
						</li>
					</ul>
				</div>
			</div>
		</div>

		<!-- Feature 3: Smart Alerts (including Cloud) -->
		<div class="grid grid-cols-1 items-center gap-8 lg:grid-cols-2">
			<div class="order-2 lg:order-1">
				<div
					class="rounded-lg border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gradient-to-br dark:from-gray-800 dark:to-gray-700"
				>
					<h3
						class="mb-3 flex items-center gap-3 text-2xl font-bold text-gray-800 dark:text-gray-100"
					>
						<FontAwesomeIcon class="h-8 w-8 text-blue-500" icon={faBell} />
						Intelligent Alert System
					</h3>
					<p class="mb-4 text-gray-600 dark:text-gray-400">
						Never miss the perfect deal with our dual alert system for both auction servers and
						cloud availability.
					</p>
					<div class="space-y-3">
						<div class="rounded bg-gray-50 p-3 dark:bg-gray-800">
							<h4 class="mb-1 font-semibold text-gray-700 dark:text-gray-200">
								Auction Price Alerts
							</h4>
							<p class="text-sm text-gray-600 dark:text-gray-400">
								Set target prices and get notified when matching servers appear
							</p>
						</div>
						<div class="rounded bg-gray-50 p-3 dark:bg-gray-800">
							<h4 class="mb-1 font-semibold text-gray-700 dark:text-gray-200">
								Cloud Availability Alerts
							</h4>
							<p class="text-sm text-gray-600 dark:text-gray-400">
								Know instantly when CAX/CCX servers become available in your region
							</p>
						</div>
					</div>
					<Button href="/alerts" size="sm" class="mt-4" color="primary">
						Configure Alerts <ArrowRightOutline class="ms-2 h-4 w-4" />
					</Button>
				</div>
			</div>
			<div class="order-1 lg:order-2">
				<div class="relative mx-2 space-y-4 lg:mx-8">
					<!-- Alert cards without headers, just the components -->

					<!-- Auction Alert -->
					<div class="relative">
						<div
							class="flex w-full max-w-md items-center gap-3 rounded-lg border-l-4 border-orange-500 bg-orange-50 p-3 shadow-sm lg:max-w-lg dark:bg-orange-900/20"
						>
							<FontAwesomeIcon icon={faGavel} class="h-4 w-4 flex-shrink-0 text-orange-500" />
							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-2">
									<div class="text-sm font-medium text-gray-800 dark:text-gray-200">
										Auction Price Alert
									</div>
									<div class="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
								</div>
								<div class="text-xs text-gray-600 dark:text-gray-400">
									i7-6700 • 32GB • Target: €25
								</div>
							</div>
							<span
								class="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200"
							>
								Active
							</span>
						</div>
					</div>

					<!-- Cloud Alert (slightly offset) -->
					<div class="relative ml-2 lg:ml-4">
						<div
							class="flex w-full max-w-md items-center gap-3 rounded-lg border-l-4 border-blue-500 bg-blue-50 p-3 shadow-sm lg:max-w-lg dark:bg-blue-900/20"
						>
							<FontAwesomeIcon icon={faClock} class="h-4 w-4 flex-shrink-0 text-blue-500" />
							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-2">
									<div class="text-sm font-medium text-gray-800 dark:text-gray-200">
										Cloud Alert
									</div>
									<div class="h-2 w-2 rounded-full bg-yellow-500"></div>
								</div>
								<div class="text-xs text-gray-600 dark:text-gray-400">CAX41 in Falkenstein</div>
							</div>
							<span
								class="rounded bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
							>
								Waiting
							</span>
						</div>
					</div>

					<!-- Recent notification (more offset) -->
					<div class="relative ml-4 lg:ml-8">
						<div
							class="flex w-full max-w-md items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 shadow-sm lg:max-w-lg dark:border-gray-600 dark:bg-gray-700/50"
						>
							<FontAwesomeIcon icon={faBell} class="h-4 w-4 flex-shrink-0 text-gray-400" />
							<div class="min-w-0 flex-1">
								<div class="text-sm font-medium text-gray-800 dark:text-gray-200">Recent Alert</div>
								<div class="text-xs text-gray-600 dark:text-gray-400">CCX33 found • 2h ago</div>
							</div>
							<span
								class="rounded bg-gray-200 px-2 py-1 text-xs text-gray-700 dark:bg-gray-600 dark:text-gray-300"
							>
								Sent
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Additional features grid -->
	<div class="mt-16">
		<h3 class="mb-8 text-center text-2xl font-medium text-gray-600 dark:text-gray-400">
			…and so much more
		</h3>
		<div class="grid grid-cols-1 gap-6 md:grid-cols-4">
			<div
				class="rounded-lg border border-gray-100 bg-white p-6 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800"
			>
				<FontAwesomeIcon icon={faForwardStep} class="mb-3 h-8 w-8 text-green-500" />
				<h4 class="mb-2 font-semibold text-gray-800 dark:text-gray-100">Real-time Data</h4>
				<p class="text-sm text-gray-600 dark:text-gray-400">
					Live server cards with real pricing, availability status, hardware specs, and instant
					updates when new auctions appear
				</p>
			</div>
			<div
				class="rounded-lg border border-gray-100 bg-white p-6 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800"
			>
				<FontAwesomeIcon icon={faServer} class="mb-3 h-8 w-8 text-blue-500" />
				<h4 class="mb-2 font-semibold text-gray-800 dark:text-gray-100">Comprehensive Details</h4>
				<p class="text-sm text-gray-600 dark:text-gray-400">
					Complete hardware specifications, pricing history, and instant availability status for
					every server configuration
				</p>
			</div>
			<div
				class="rounded-lg border border-gray-100 bg-white p-6 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800"
			>
				<FontAwesomeIcon icon={faGithub} class="mb-3 h-8 w-8 text-gray-700 dark:text-gray-300" />
				<h4 class="mb-2 font-semibold text-gray-800 dark:text-gray-100">Open Source</h4>
				<p class="text-sm text-gray-600 dark:text-gray-400">
					Transparent, community-driven development you can trust and contribute to
				</p>
			</div>
			<div
				class="rounded-lg border border-gray-100 bg-white p-6 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800"
			>
				<FontAwesomeIcon icon={faUsers} class="mb-3 h-8 w-8 text-orange-500" />
				<h4 class="mb-2 font-semibold text-gray-800 dark:text-gray-100">Active Community</h4>
				<p class="text-sm text-gray-600 dark:text-gray-400">
					Join 100+ users sharing tips and strategies in our Discord
				</p>
			</div>
		</div>
	</div>
</section>
