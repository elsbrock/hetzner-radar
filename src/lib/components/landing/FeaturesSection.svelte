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
	import SectionEyebrow from './SectionEyebrow.svelte';
</script>

<section id="features" class="mx-auto my-20 max-w-5xl">
	<div class="mb-12 text-center">
		<SectionEyebrow label="Coverage" />
		<h2 class="mt-3 mb-4 text-3xl font-semibold text-gray-800 dark:text-gray-100">
			What Server Radar tracks
		</h2>
		<p class="mx-auto max-w-2xl text-gray-600 dark:text-gray-400">
			Two independent data feeds for the two parts of Hetzner's catalogue most worth watching.
		</p>
	</div>

	<!-- Two main product areas -->
	<div class="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
		<!-- Dedicated Servers -->
		<div
			class="signal-edge group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-lg hover:shadow-orange-500/5 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-orange-500/50"
		>
			<div
				class="radar-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(120%_80%_at_100%_0%,black,transparent)]"
			></div>
			<div class="relative">
				<div class="mb-4 flex items-center gap-3">
					<div
						class="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30"
					>
						<FontAwesomeIcon icon={faServer} class="h-5 w-5 text-orange-500" />
					</div>
					<h3 class="text-xl font-semibold text-gray-800 dark:text-gray-100">Dedicated Servers</h3>
					<span
						class="ms-auto rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 font-mono text-[10px] font-medium tracking-wider text-orange-600 uppercase dark:border-orange-500/30 dark:bg-orange-900/20 dark:text-orange-400"
					>
						3mo history
					</span>
				</div>
				<p class="mb-4 text-gray-600 dark:text-gray-400">
					Auction listings and standard dedicated SKUs in one filterable view, with three months of
					per-configuration price history so you can tell a real deal from a normal day.
				</p>
				<ul class="mb-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
					<li class="flex items-center gap-2">
						<FontAwesomeIcon icon={faFilter} class="h-4 w-4 text-orange-400" />
						Filter by CPU, RAM, storage, location, price
					</li>
					<li class="flex items-center gap-2">
						<FontAwesomeIcon icon={faChartLine} class="h-4 w-4 text-orange-400" />
						Historical price charts with min/max/average
					</li>
					<li class="flex items-center gap-2">
						<FontAwesomeIcon icon={faBell} class="h-4 w-4 text-orange-400" />
						Price alerts via email or Discord
					</li>
					<li class="flex items-center gap-2">
						<FontAwesomeIcon icon={faLink} class="h-4 w-4 text-orange-400" />
						Direct links to Hetzner's configurator
					</li>
				</ul>
				<Button href="/analyze" size="sm" color="light">
					Browse Servers
					<ArrowRightOutline class="ms-2 h-4 w-4" />
				</Button>
			</div>
		</div>

		<!-- Cloud Availability -->
		<div
			class="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-500/5 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-500/50"
		>
			<div
				class="radar-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(120%_80%_at_100%_0%,black,transparent)]"
			></div>
			<div class="relative">
				<div class="mb-4 flex items-center gap-3">
					<div
						class="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30"
					>
						<FontAwesomeIcon icon={faCloud} class="h-5 w-5 text-blue-500" />
					</div>
					<h3 class="text-xl font-semibold text-gray-800 dark:text-gray-100">
						Cloud Server Availability
					</h3>
					<span
						class="ms-auto inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-medium tracking-wider text-emerald-600 uppercase dark:border-emerald-500/30 dark:bg-emerald-900/20 dark:text-emerald-400"
					>
						<span class="signal-dot" aria-hidden="true"></span>
						Live
					</span>
				</div>
				<p class="mb-4 text-gray-600 dark:text-gray-400">
					Stock for every Hetzner Cloud server type (CX, CPX, CCX, CAX) across all locations, sampled
					continuously. Get notified the moment a sold-out type returns to a specific datacenter.
				</p>
				<ul class="mb-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
					<li class="flex items-center gap-2">
						<FontAwesomeIcon icon={faMapMarkerAlt} class="h-4 w-4 text-blue-400" />
						Availability by datacenter location
					</li>
					<li class="flex items-center gap-2">
						<FontAwesomeIcon icon={faGlobe} class="h-4 w-4 text-blue-400" />
						Interactive map with status indicators
					</li>
					<li class="flex items-center gap-2">
						<FontAwesomeIcon icon={faBell} class="h-4 w-4 text-blue-400" />
						Availability alerts via email or Discord
					</li>
					<li class="flex items-center gap-2">
						<FontAwesomeIcon icon={faChartLine} class="h-4 w-4 text-blue-400" />
						Availability patterns over time
					</li>
				</ul>
				<Button href="/cloud-status" size="sm" color="light">
					View Cloud Status
					<ArrowRightOutline class="ms-2 h-4 w-4" />
				</Button>
			</div>
		</div>
	</div>

	<!-- Additional features row -->
	<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
		<div
			class="signal-edge group rounded-xl border border-gray-200 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-orange-200 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-orange-500/40"
		>
			<h4 class="mb-1 font-medium text-gray-800 dark:text-gray-100">Statistics</h4>
			<p class="text-sm text-gray-600 dark:text-gray-400">
				Price trends, volume by datacenter, AMD vs Intel comparisons
			</p>
		</div>

		<div
			class="signal-edge group rounded-xl border border-gray-200 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-orange-200 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-orange-500/40"
		>
			<h4 class="mb-1 font-medium text-gray-800 dark:text-gray-100">Saved Filters</h4>
			<p class="text-sm text-gray-600 dark:text-gray-400">
				Save and share filter configurations via URL
			</p>
		</div>

		<div
			class="signal-edge group rounded-xl border border-gray-200 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-orange-200 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-orange-500/40"
		>
			<h4 class="mb-1 font-medium text-gray-800 dark:text-gray-100">Multi-Currency</h4>
			<p class="text-sm text-gray-600 dark:text-gray-400">
				View prices in EUR or USD with VAT options
			</p>
		</div>

		<div
			class="signal-edge group rounded-xl border border-gray-200 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-orange-200 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-orange-500/40"
		>
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
