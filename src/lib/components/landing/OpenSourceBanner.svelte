<script lang="ts">
	import { faGithub } from '@fortawesome/free-brands-svg-icons';
	import { faStar, faCodeBranch } from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
</script>

<section class="mx-auto my-20 max-w-4xl">
	<div
		class="relative overflow-hidden rounded-xl border border-gray-200 bg-white p-8 dark:border-gray-700 dark:bg-gray-800"
	>
		<!-- Background pattern -->
		<div class="pointer-events-none absolute inset-0 opacity-5">
			<div class="absolute top-4 right-4 h-32 w-32 rounded-full bg-gray-900 dark:bg-white"></div>
			<div class="absolute bottom-4 left-4 h-24 w-24 rounded-full bg-gray-900 dark:bg-white"></div>
		</div>
		
		<div class="relative flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
			<div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-700">
				<FontAwesomeIcon icon={faGithub} class="h-8 w-8 text-gray-700 dark:text-gray-300" />
			</div>
			<div class="flex-1">
				<h3 class="mb-1 text-xl font-bold text-gray-900 dark:text-gray-50">Open Source and Free Forever</h3>
				<p class="text-gray-600 dark:text-gray-400">
					Built with SvelteKit, DuckDB, and Cloudflare Workers. MIT licensed. Contributions welcome.
				</p>
			</div>
			<div class="flex flex-col gap-3 sm:flex-row">
				<a
					href="https://github.com/elsbrock/hetzner-radar"
					class="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
				>
					<FontAwesomeIcon icon={faStar} class="h-4 w-4" />
					Star on GitHub
				</a>
				<a
					href="https://github.com/elsbrock/hetzner-radar/fork"
					class="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
				>
					<FontAwesomeIcon icon={faCodeBranch} class="h-4 w-4" />
					Fork
				</a>
			</div>
		</div>
	</div>
</section>
