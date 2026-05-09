<script lang="ts">
	import { faGithub } from '@fortawesome/free-brands-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
</script>

<section class="border-b border-gray-200 bg-gray-50 py-12 dark:border-gray-800 dark:bg-gray-900/50">
	<div class="mx-auto max-w-6xl px-6">
		<div class="flex flex-col items-center justify-between gap-6 rounded-xl border border-gray-200 bg-white p-6 sm:flex-row sm:p-8 dark:border-gray-800 dark:bg-gray-900">
			<div class="flex items-center gap-5">
				<div class="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800">
					<FontAwesomeIcon icon={faGithub} class="h-6 w-6 text-gray-900 dark:text-white" />
				</div>
				<div>
					<p class="font-semibold text-gray-900 dark:text-white">100% Open Source</p>
					<p class="text-sm text-gray-600 dark:text-gray-400">
						Built with SvelteKit, DuckDB, and Cloudflare Workers
					</p>
				</div>
			</div>
			<a
				href="https://github.com/elsbrock/hetzner-radar"
				class="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
			>
				<FontAwesomeIcon icon={faGithub} class="h-4 w-4" />
				View on GitHub
			</a>
		</div>
	</div>
</section>
