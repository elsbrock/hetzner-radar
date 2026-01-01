<script lang="ts">
	import {
		faDatabase,
		faMemory,
		faServer,
		faHardDrive,
		faArrowRight
	} from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
</script>

<section class="mx-auto my-16 max-w-4xl">
	<h2 class="mb-4 text-center text-2xl font-semibold text-gray-800 dark:text-gray-100">
		Curated Configurations
	</h2>
	<p class="mx-auto mb-8 max-w-2xl text-center text-gray-600 dark:text-gray-400">
		Not sure what you need? Browse pre-filtered lists optimized for different use cases — whether
		you're looking for the lowest price, maximum RAM for virtualization, or fast NVMe storage.
	</p>

	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<a
			href="/configurations#affordable"
			class="rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-orange-300 hover:bg-orange-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-orange-600 dark:hover:bg-orange-900/20"
		>
			<FontAwesomeIcon icon={faServer} class="mb-2 h-6 w-6 text-orange-500" />
			<h3 class="font-medium text-gray-800 dark:text-gray-100">Most Affordable</h3>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
				Lowest absolute price for budget projects
			</p>
		</a>

		<a
			href="/configurations#ram"
			class="rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-purple-300 hover:bg-purple-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-purple-600 dark:hover:bg-purple-900/20"
		>
			<FontAwesomeIcon icon={faMemory} class="mb-2 h-6 w-6 text-purple-500" />
			<h3 class="font-medium text-gray-800 dark:text-gray-100">Best RAM per €</h3>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
				Ideal for VMs, databases, caching
			</p>
		</a>

		<a
			href="/configurations#storage"
			class="rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-blue-300 hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-600 dark:hover:bg-blue-900/20"
		>
			<FontAwesomeIcon icon={faDatabase} class="mb-2 h-6 w-6 text-blue-500" />
			<h3 class="font-medium text-gray-800 dark:text-gray-100">Best Storage per €</h3>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
				Backups, media servers, archives
			</p>
		</a>

		<a
			href="/configurations#nvme"
			class="rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-green-300 hover:bg-green-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-green-600 dark:hover:bg-green-900/20"
		>
			<FontAwesomeIcon icon={faHardDrive} class="mb-2 h-6 w-6 text-green-500" />
			<h3 class="font-medium text-gray-800 dark:text-gray-100">Best NVMe per €</h3>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
				Fast storage for databases, CI/CD
			</p>
		</a>
	</div>

	<div class="mt-6 text-center">
		<a
			href="/configurations"
			class="inline-flex items-center gap-2 text-sm text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300"
		>
			View all configurations
			<FontAwesomeIcon icon={faArrowRight} class="h-3 w-3" />
		</a>
	</div>
</section>
