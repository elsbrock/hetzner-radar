<script lang="ts">
	import {
		faBell,
		faChartLine,
		faCloud,
		faFilter,
		faGlobe,
		faLink,
		faMapMarkerAlt,
		faServer
	} from '@fortawesome/free-solid-svg-icons';
	import { faDiscord } from '@fortawesome/free-brands-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { Button } from 'flowbite-svelte';
	import { ArrowRightOutline } from 'flowbite-svelte-icons';
</script>

<section id="features" class="mx-auto my-24 max-w-6xl">
	<div class="mb-4 text-center">
		<span class="inline-block rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
			Complete Coverage
		</span>
	</div>
	<h2 class="mb-4 text-balance text-center text-3xl font-bold text-gray-900 dark:text-gray-50">
		Two data feeds. One comprehensive view.
	</h2>
	<p class="mx-auto mb-14 max-w-2xl text-pretty text-center text-gray-600 dark:text-gray-400">
		Monitor both dedicated server auctions and cloud availability from a single dashboard. Know exactly when to buy.
	</p>

	<!-- Two main product areas -->
	<div class="mb-14 grid grid-cols-1 gap-8 lg:grid-cols-2">
		<!-- Dedicated Servers -->
		<div class="group rounded-xl border border-gray-200 bg-white p-8 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
			<div class="mb-5 flex items-center gap-4">
				<div class="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-900/30">
					<FontAwesomeIcon icon={faServer} class="h-6 w-6 text-orange-500" />
				</div>
				<div>
					<h3 class="text-xl font-bold text-gray-900 dark:text-gray-50">Dedicated Server Auctions</h3>
					<p class="text-sm text-gray-500 dark:text-gray-400">90 days of price history</p>
				</div>
			</div>
			<p class="mb-6 leading-relaxed text-gray-600 dark:text-gray-400">
				Auction listings and standard dedicated SKUs in one filterable view. Instantly distinguish a real deal from normal market fluctuation with historical context.
			</p>
			<ul class="mb-6 space-y-3 text-sm text-gray-600 dark:text-gray-400">
				<li class="flex items-center gap-3">
					<div class="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
						<FontAwesomeIcon icon={faFilter} class="h-3 w-3 text-gray-500 dark:text-gray-400" />
					</div>
					Filter by CPU, RAM, storage, location, price
				</li>
				<li class="flex items-center gap-3">
					<div class="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
						<FontAwesomeIcon icon={faChartLine} class="h-3 w-3 text-gray-500 dark:text-gray-400" />
					</div>
					Historical price charts with min/max/average
				</li>
				<li class="flex items-center gap-3">
					<div class="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
						<FontAwesomeIcon icon={faBell} class="h-3 w-3 text-gray-500 dark:text-gray-400" />
					</div>
					Price alerts via email or Discord webhook
				</li>
				<li class="flex items-center gap-3">
					<div class="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
						<FontAwesomeIcon icon={faLink} class="h-3 w-3 text-gray-500 dark:text-gray-400" />
					</div>
					Direct links to Hetzner configurator
				</li>
			</ul>
			<Button href="/analyze" size="sm" color="light" class="group-hover:bg-gray-50 dark:group-hover:bg-gray-700">
				Browse Servers
				<ArrowRightOutline class="ms-2 h-4 w-4" />
			</Button>
		</div>

		<!-- Cloud Availability -->
		<div class="group rounded-xl border border-gray-200 bg-white p-8 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
			<div class="mb-5 flex items-center gap-4">
				<div class="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
					<FontAwesomeIcon icon={faCloud} class="h-6 w-6 text-blue-500" />
				</div>
				<div>
					<h3 class="text-xl font-bold text-gray-900 dark:text-gray-50">Cloud Server Availability</h3>
					<p class="text-sm text-gray-500 dark:text-gray-400">Real-time stock monitoring</p>
				</div>
			</div>
			<p class="mb-6 leading-relaxed text-gray-600 dark:text-gray-400">
				Stock status for every Hetzner Cloud server type (CX, CPX, CCX, CAX) across all datacenters. Get notified the moment a sold-out type returns.
			</p>
			<ul class="mb-6 space-y-3 text-sm text-gray-600 dark:text-gray-400">
				<li class="flex items-center gap-3">
					<div class="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
						<FontAwesomeIcon icon={faMapMarkerAlt} class="h-3 w-3 text-gray-500 dark:text-gray-400" />
					</div>
					Availability by datacenter location
				</li>
				<li class="flex items-center gap-3">
					<div class="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
						<FontAwesomeIcon icon={faGlobe} class="h-3 w-3 text-gray-500 dark:text-gray-400" />
					</div>
					Interactive map with status indicators
				</li>
				<li class="flex items-center gap-3">
					<div class="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
						<FontAwesomeIcon icon={faBell} class="h-3 w-3 text-gray-500 dark:text-gray-400" />
					</div>
					Availability alerts via email or Discord
				</li>
				<li class="flex items-center gap-3">
					<div class="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
						<FontAwesomeIcon icon={faChartLine} class="h-3 w-3 text-gray-500 dark:text-gray-400" />
					</div>
					Historical availability patterns
				</li>
			</ul>
			<Button href="/cloud-status" size="sm" color="light" class="group-hover:bg-gray-50 dark:group-hover:bg-gray-700">
				View Cloud Status
				<ArrowRightOutline class="ms-2 h-4 w-4" />
			</Button>
		</div>
	</div>

	<!-- Additional features row -->
	<div class="rounded-xl border border-gray-200 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-800/50">
		<p class="mb-5 text-center text-sm font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Also included</p>
		<div class="grid grid-cols-2 gap-6 md:grid-cols-4">
			<div class="text-center">
				<div class="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm dark:bg-gray-700">
					<FontAwesomeIcon icon={faChartLine} class="h-5 w-5 text-gray-600 dark:text-gray-300" />
				</div>
				<h4 class="font-medium text-gray-800 dark:text-gray-100">Market Statistics</h4>
				<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
					Trends, AMD vs Intel, datacenter volume
				</p>
			</div>

			<div class="text-center">
				<div class="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm dark:bg-gray-700">
					<FontAwesomeIcon icon={faFilter} class="h-5 w-5 text-gray-600 dark:text-gray-300" />
				</div>
				<h4 class="font-medium text-gray-800 dark:text-gray-100">Shareable Filters</h4>
				<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
					Save and share filter configs via URL
				</p>
			</div>

			<div class="text-center">
				<div class="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm dark:bg-gray-700">
					<FontAwesomeIcon icon={faGlobe} class="h-5 w-5 text-gray-600 dark:text-gray-300" />
				</div>
				<h4 class="font-medium text-gray-800 dark:text-gray-100">Multi-Currency</h4>
				<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
					EUR or USD with VAT options
				</p>
			</div>

			<div class="text-center">
				<div class="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm dark:bg-gray-700">
					<FontAwesomeIcon icon={faDiscord} class="h-5 w-5 text-gray-600 dark:text-gray-300" />
				</div>
				<h4 class="font-medium text-gray-800 dark:text-gray-100">Discord Webhooks</h4>
				<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
					Alerts to your Discord server
				</p>
			</div>
		</div>
	</div>
</section>
