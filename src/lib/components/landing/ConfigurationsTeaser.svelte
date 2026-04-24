<script lang="ts">
	import {
		faBolt,
		faDatabase,
		faMemory,
		faServer,
		faHardDrive,
		faArrowRight
	} from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
</script>

<section class="mx-auto my-16 max-w-5xl">
	<h2 class="mb-4 text-center text-2xl font-semibold text-gray-800 dark:text-gray-100">
		Top deals by category
	</h2>
	<p class="mx-auto mb-8 max-w-2xl text-center text-gray-600 dark:text-gray-400">
		Live rankings of current auction listings, scored against the metric that matters for each
		workload. Updated every few minutes.
	</p>

	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
		<a
			href="/configurations#price-performance"
			class="rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-amber-300 hover:bg-amber-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-amber-600 dark:hover:bg-amber-900/20"
		>
			<FontAwesomeIcon icon={faBolt} class="mb-2 h-6 w-6 text-amber-500" />
			<h3 class="font-medium text-gray-800 dark:text-gray-100">Best price/performance</h3>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
				Lowest € per Geekbench 5 multicore point
			</p>
		</a>

		<a
			href="/configurations#affordable"
			class="rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-orange-300 hover:bg-orange-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-orange-600 dark:hover:bg-orange-900/20"
		>
			<FontAwesomeIcon icon={faServer} class="mb-2 h-6 w-6 text-orange-500" />
			<h3 class="font-medium text-gray-800 dark:text-gray-100">Cheapest absolute</h3>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
				Lowest monthly price with a usable CPU floor
			</p>
		</a>

		<a
			href="/configurations#ram"
			class="rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-purple-300 hover:bg-purple-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-purple-600 dark:hover:bg-purple-900/20"
		>
			<FontAwesomeIcon icon={faMemory} class="mb-2 h-6 w-6 text-purple-500" />
			<h3 class="font-medium text-gray-800 dark:text-gray-100">Best € per GB RAM</h3>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
				For VMs, in-memory caches, large databases
			</p>
		</a>

		<a
			href="/configurations#nvme"
			class="rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-green-300 hover:bg-green-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-green-600 dark:hover:bg-green-900/20"
		>
			<FontAwesomeIcon icon={faHardDrive} class="mb-2 h-6 w-6 text-green-500" />
			<h3 class="font-medium text-gray-800 dark:text-gray-100">Best € per TB NVMe</h3>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
				Hot storage for OLTP, build caches, indexes
			</p>
		</a>

		<a
			href="/configurations#storage"
			class="rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-blue-300 hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-600 dark:hover:bg-blue-900/20"
		>
			<FontAwesomeIcon icon={faDatabase} class="mb-2 h-6 w-6 text-blue-500" />
			<h3 class="font-medium text-gray-800 dark:text-gray-100">Best € per TB bulk</h3>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
				SATA + HDD for backups, archives, media
			</p>
		</a>
	</div>

	<div class="mt-6 text-center">
		<a
			href="/configurations"
			class="inline-flex items-center gap-2 text-sm text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300"
		>
			View all categories
			<FontAwesomeIcon icon={faArrowRight} class="h-3 w-3" />
		</a>
	</div>
</section>
