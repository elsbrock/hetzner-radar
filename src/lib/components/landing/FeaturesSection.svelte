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

<section id="features" class="mx-auto my-20 max-w-6xl">
	<h2 class="mb-12 text-center text-3xl font-semibold text-gray-800 dark:text-gray-100">
		Features
	</h2>

	<!-- Two main product areas -->
	<div class="mb-12 grid grid-cols-1 gap-8 lg:grid-cols-2">
		<!-- Auction Tracking -->
		<div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
			<div class="mb-4 flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
					<FontAwesomeIcon icon={faServer} class="h-5 w-5 text-orange-500" />
				</div>
				<h3 class="text-xl font-semibold text-gray-800 dark:text-gray-100">Dedicated Server Auctions</h3>
			</div>
			<p class="mb-4 text-gray-600 dark:text-gray-400">
				Browse Hetzner's server auction with advanced filtering. View 3 months of price history to
				find the right time to buy.
			</p>
			<ul class="mb-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
				<li class="flex items-center gap-2">
					<FontAwesomeIcon icon={faFilter} class="h-4 w-4 text-gray-400" />
					Filter by CPU, RAM, storage, location, price
				</li>
				<li class="flex items-center gap-2">
					<FontAwesomeIcon icon={faChartLine} class="h-4 w-4 text-gray-400" />
					Historical price charts with min/max/average
				</li>
				<li class="flex items-center gap-2">
					<FontAwesomeIcon icon={faBell} class="h-4 w-4 text-gray-400" />
					Price alerts via email or Discord
				</li>
				<li class="flex items-center gap-2">
					<FontAwesomeIcon icon={faLink} class="h-4 w-4 text-gray-400" />
					Direct links to Hetzner's configurator
				</li>
			</ul>
			<Button href="/analyze" size="sm" color="light">
				Browse Auctions
				<ArrowRightOutline class="ms-2 h-4 w-4" />
			</Button>
		</div>

		<!-- Cloud Availability -->
		<div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
			<div class="mb-4 flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
					<FontAwesomeIcon icon={faCloud} class="h-5 w-5 text-blue-500" />
				</div>
				<h3 class="text-xl font-semibold text-gray-800 dark:text-gray-100">Cloud Server Availability</h3>
			</div>
			<p class="mb-4 text-gray-600 dark:text-gray-400">
				Monitor availability of Hetzner Cloud servers (CAX, CCX, etc.) across all datacenters.
				Get notified when sold-out servers come back in stock.
			</p>
			<ul class="mb-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
				<li class="flex items-center gap-2">
					<FontAwesomeIcon icon={faMapMarkerAlt} class="h-4 w-4 text-gray-400" />
					Availability by datacenter location
				</li>
				<li class="flex items-center gap-2">
					<FontAwesomeIcon icon={faGlobe} class="h-4 w-4 text-gray-400" />
					Interactive map with status indicators
				</li>
				<li class="flex items-center gap-2">
					<FontAwesomeIcon icon={faBell} class="h-4 w-4 text-gray-400" />
					Availability alerts via email or Discord
				</li>
				<li class="flex items-center gap-2">
					<FontAwesomeIcon icon={faChartLine} class="h-4 w-4 text-gray-400" />
					Availability patterns over time
				</li>
			</ul>
			<Button href="/cloud-status" size="sm" color="light">
				View Cloud Status
				<ArrowRightOutline class="ms-2 h-4 w-4" />
			</Button>
		</div>
	</div>

	<!-- Additional features row -->
	<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
		<div class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
			<h4 class="mb-1 font-medium text-gray-800 dark:text-gray-100">Statistics</h4>
			<p class="text-sm text-gray-600 dark:text-gray-400">
				Price trends, volume by datacenter, AMD vs Intel comparisons
			</p>
		</div>

		<div class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
			<h4 class="mb-1 font-medium text-gray-800 dark:text-gray-100">Saved Filters</h4>
			<p class="text-sm text-gray-600 dark:text-gray-400">
				Save and share filter configurations via URL
			</p>
		</div>

		<div class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
			<h4 class="mb-1 font-medium text-gray-800 dark:text-gray-100">Multi-Currency</h4>
			<p class="text-sm text-gray-600 dark:text-gray-400">
				View prices in EUR, USD, GBP with VAT options
			</p>
		</div>

		<div class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
			<div class="flex items-center gap-2">
				<FontAwesomeIcon icon={faDiscord} class="h-4 w-4 text-gray-500" />
				<h4 class="font-medium text-gray-800 dark:text-gray-100">Discord Webhooks</h4>
			</div>
			<p class="text-sm text-gray-600 dark:text-gray-400">
				Send alerts directly to your Discord server
			</p>
		</div>
	</div>
</section>
