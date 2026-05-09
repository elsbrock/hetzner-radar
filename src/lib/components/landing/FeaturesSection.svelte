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

<section id="features" class="border-b border-gray-200 bg-white py-20 md:py-28 dark:border-gray-800 dark:bg-gray-950">
	<div class="mx-auto max-w-6xl px-6">
		<div class="mb-16 text-center">
			<h2 class="mb-4 text-3xl font-bold tracking-tight text-gray-900 md:text-4xl dark:text-white">
				What Server Radar tracks
			</h2>
			<p class="mx-auto max-w-2xl text-lg text-gray-600 dark:text-gray-400">
				Two independent data feeds for the two parts of Hetzner&apos;s catalogue most worth watching.
			</p>
		</div>

		<!-- Two main product areas -->
		<div class="mb-16 grid gap-6 lg:grid-cols-2">
			<!-- Dedicated Servers -->
			<div class="group rounded-xl border border-gray-200 bg-gray-50/50 p-8 transition-all hover:border-gray-300 hover:bg-white dark:border-gray-800 dark:bg-gray-900/50 dark:hover:border-gray-700 dark:hover:bg-gray-900">
				<div class="mb-6 flex items-center gap-4">
					<div class="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/30">
						<FontAwesomeIcon icon={faServer} class="h-6 w-6 text-primary-600 dark:text-primary-400" />
					</div>
					<h3 class="text-xl font-semibold text-gray-900 dark:text-white">Dedicated Servers</h3>
				</div>
				<p class="mb-6 text-gray-600 dark:text-gray-400">
					Auction listings and standard dedicated SKUs in one filterable view, with three months of per-configuration price history so you can tell a real deal from a normal day.
				</p>
				<ul class="mb-8 space-y-3">
					<li class="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
						<FontAwesomeIcon icon={faFilter} class="h-4 w-4 text-gray-400 dark:text-gray-500" />
						<span>Filter by CPU, RAM, storage, location, price</span>
					</li>
					<li class="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
						<FontAwesomeIcon icon={faChartLine} class="h-4 w-4 text-gray-400 dark:text-gray-500" />
						<span>Historical price charts with min/max/average</span>
					</li>
					<li class="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
						<FontAwesomeIcon icon={faBell} class="h-4 w-4 text-gray-400 dark:text-gray-500" />
						<span>Price alerts via email or Discord</span>
					</li>
					<li class="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
						<FontAwesomeIcon icon={faLink} class="h-4 w-4 text-gray-400 dark:text-gray-500" />
						<span>Direct links to Hetzner&apos;s configurator</span>
					</li>
				</ul>
				<Button href="/analyze" class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
					Browse Servers
					<ArrowRightOutline class="ml-2 h-4 w-4" />
				</Button>
			</div>

			<!-- Cloud Availability -->
			<div class="group rounded-xl border border-gray-200 bg-gray-50/50 p-8 transition-all hover:border-gray-300 hover:bg-white dark:border-gray-800 dark:bg-gray-900/50 dark:hover:border-gray-700 dark:hover:bg-gray-900">
				<div class="mb-6 flex items-center gap-4">
					<div class="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
						<FontAwesomeIcon icon={faCloud} class="h-6 w-6 text-blue-600 dark:text-blue-400" />
					</div>
					<h3 class="text-xl font-semibold text-gray-900 dark:text-white">Cloud Server Availability</h3>
				</div>
				<p class="mb-6 text-gray-600 dark:text-gray-400">
					Stock for every Hetzner Cloud server type (CX, CPX, CCX, CAX) across all locations, sampled continuously. Get notified the moment a sold-out type returns to a specific datacenter.
				</p>
				<ul class="mb-8 space-y-3">
					<li class="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
						<FontAwesomeIcon icon={faMapMarkerAlt} class="h-4 w-4 text-gray-400 dark:text-gray-500" />
						<span>Availability by datacenter location</span>
					</li>
					<li class="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
						<FontAwesomeIcon icon={faGlobe} class="h-4 w-4 text-gray-400 dark:text-gray-500" />
						<span>Interactive map with status indicators</span>
					</li>
					<li class="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
						<FontAwesomeIcon icon={faBell} class="h-4 w-4 text-gray-400 dark:text-gray-500" />
						<span>Availability alerts via email or Discord</span>
					</li>
					<li class="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
						<FontAwesomeIcon icon={faChartLine} class="h-4 w-4 text-gray-400 dark:text-gray-500" />
						<span>Availability patterns over time</span>
					</li>
				</ul>
				<Button href="/cloud-status" class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
					View Cloud Status
					<ArrowRightOutline class="ml-2 h-4 w-4" />
				</Button>
			</div>
		</div>

		<!-- Additional features row -->
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<div class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
				<h4 class="mb-2 font-semibold text-gray-900 dark:text-white">Statistics</h4>
				<p class="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
					Price trends, volume by datacenter, AMD vs Intel comparisons
				</p>
			</div>

			<div class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
				<h4 class="mb-2 font-semibold text-gray-900 dark:text-white">Saved Filters</h4>
				<p class="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
					Save and share filter configurations via URL
				</p>
			</div>

			<div class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
				<h4 class="mb-2 font-semibold text-gray-900 dark:text-white">Multi-Currency</h4>
				<p class="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
					View prices in EUR or USD with VAT options
				</p>
			</div>

			<div class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
				<div class="mb-2 flex items-center gap-2">
					<FontAwesomeIcon icon={faDiscord} class="h-4 w-4 text-gray-500 dark:text-gray-400" />
					<h4 class="font-semibold text-gray-900 dark:text-white">Discord Webhooks</h4>
				</div>
				<p class="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
					Send alerts directly to your Discord server
				</p>
			</div>
		</div>
	</div>
</section>
