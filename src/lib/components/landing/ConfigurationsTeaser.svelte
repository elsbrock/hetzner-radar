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

<section class="mx-auto my-20 max-w-5xl">
	<div class="mb-4 text-center">
		<span class="inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
			Curated Rankings
		</span>
	</div>
	<h2 class="mb-4 text-balance text-center text-2xl font-bold text-gray-900 dark:text-gray-50">
		Find the best deal for your workload
	</h2>
	<p class="mx-auto mb-10 max-w-2xl text-pretty text-center text-gray-600 dark:text-gray-400">
		Live rankings scored against the metric that matters most for each use case. Updated automatically every few minutes.
	</p>

	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
		<a
			href="/configurations#price-performance"
			class="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-amber-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-amber-600"
		>
			<div class="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 transition-colors group-hover:bg-amber-200 dark:bg-amber-900/30 dark:group-hover:bg-amber-900/50">
				<FontAwesomeIcon icon={faBolt} class="h-5 w-5 text-amber-600 dark:text-amber-400" />
			</div>
			<h3 class="font-semibold text-gray-900 dark:text-gray-50">Price/Performance</h3>
			<p class="mt-1 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
				Best value per Geekbench point
			</p>
		</a>

		<a
			href="/configurations#affordable"
			class="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-orange-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-orange-600"
		>
			<div class="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 transition-colors group-hover:bg-orange-200 dark:bg-orange-900/30 dark:group-hover:bg-orange-900/50">
				<FontAwesomeIcon icon={faServer} class="h-5 w-5 text-orange-600 dark:text-orange-400" />
			</div>
			<h3 class="font-semibold text-gray-900 dark:text-gray-50">Budget Friendly</h3>
			<p class="mt-1 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
				Lowest monthly cost
			</p>
		</a>

		<a
			href="/configurations#ram"
			class="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-orange-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-orange-600"
		>
			<div class="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 transition-colors group-hover:bg-orange-200 dark:bg-orange-900/30 dark:group-hover:bg-orange-900/50">
				<FontAwesomeIcon icon={faMemory} class="h-5 w-5 text-orange-600 dark:text-orange-400" />
			</div>
			<h3 class="font-semibold text-gray-900 dark:text-gray-50">Memory Optimized</h3>
			<p class="mt-1 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
				Best price per GB RAM
			</p>
		</a>

		<a
			href="/configurations#nvme"
			class="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-orange-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-orange-600"
		>
			<div class="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 transition-colors group-hover:bg-orange-200 dark:bg-orange-900/30 dark:group-hover:bg-orange-900/50">
				<FontAwesomeIcon icon={faHardDrive} class="h-5 w-5 text-orange-600 dark:text-orange-400" />
			</div>
			<h3 class="font-semibold text-gray-900 dark:text-gray-50">NVMe Storage</h3>
			<p class="mt-1 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
				Best price per TB NVMe
			</p>
		</a>

		<a
			href="/configurations#storage"
			class="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-orange-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-orange-600"
		>
			<div class="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 transition-colors group-hover:bg-orange-200 dark:bg-orange-900/30 dark:group-hover:bg-orange-900/50">
				<FontAwesomeIcon icon={faDatabase} class="h-5 w-5 text-orange-600 dark:text-orange-400" />
			</div>
			<h3 class="font-semibold text-gray-900 dark:text-gray-50">Bulk Storage</h3>
			<p class="mt-1 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
				SATA + HDD for archives
			</p>
		</a>
	</div>

	<div class="mt-8 text-center">
		<a
			href="/configurations"
			class="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all hover:border-gray-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-600"
		>
			View all categories
			<FontAwesomeIcon icon={faArrowRight} class="h-3 w-3" />
		</a>
	</div>
</section>
