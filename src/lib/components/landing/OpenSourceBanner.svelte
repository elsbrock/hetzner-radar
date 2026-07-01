<script lang="ts">
	import { faGithub } from '@fortawesome/free-brands-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
</script>

<section class="mx-auto my-16 max-w-5xl">
	<div
		class="signal-edge relative flex flex-col items-center justify-between gap-4 overflow-hidden rounded-xl border border-gray-200 bg-white p-6 sm:flex-row dark:border-gray-700 dark:bg-gray-800"
	>
		<div
			class="radar-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(120%_120%_at_0%_50%,black,transparent)]"
		></div>
		<div class="relative flex items-center gap-4">
			<FontAwesomeIcon icon={faGithub} class="h-8 w-8 text-gray-700 dark:text-gray-300" />
			<div>
				<div class="flex items-center gap-2">
					<p class="font-medium text-gray-800 dark:text-gray-100">Open Source</p>
					<span
						class="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 font-mono text-[10px] font-medium tracking-wider text-gray-500 uppercase dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400"
					>
						MIT
					</span>
				</div>
				<p class="text-sm text-gray-500 dark:text-gray-400">
					Built with SvelteKit, DuckDB, and Cloudflare Workers
				</p>
			</div>
		</div>
		<a
			href="https://github.com/elsbrock/hetzner-radar"
			class="relative inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
		>
			<FontAwesomeIcon icon={faGithub} class="h-4 w-4" />
			View on GitHub
		</a>
	</div>
</section>
