<script lang="ts">
	import {
		faChartLine,
		faMemory,
		faMicrochip,
		faGlobe
	} from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { Button } from 'flowbite-svelte';
	import { ArrowRightOutline } from 'flowbite-svelte-icons';
</script>

<section class="mx-auto my-16 max-w-5xl">
	<div class="rounded-lg border border-gray-200 bg-white p-8 dark:border-gray-700 dark:bg-gray-800">
		<div class="grid grid-cols-1 items-center gap-8 lg:grid-cols-2">
			<!-- Left: Description -->
			<div>
				<div class="mb-4 flex items-center gap-3">
					<div
						class="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30"
					>
						<FontAwesomeIcon icon={faChartLine} class="h-5 w-5 text-orange-500" />
					</div>
					<h2 class="text-2xl font-semibold text-gray-800 dark:text-gray-100">Market Statistics</h2>
				</div>
				<p class="mb-6 text-gray-600 dark:text-gray-400">
					Track auction market trends over time. See how prices evolve, compare AMD vs Intel
					pricing, and understand volume patterns across datacenters.
				</p>
				<Button href="/statistics" color="light" size="sm">
					View Statistics
					<ArrowRightOutline class="ms-2 h-4 w-4" />
				</Button>
			</div>

			<!-- Right: Stat highlights -->
			<div class="grid grid-cols-2 gap-4">
				<div class="rounded-lg bg-gray-50 p-4 dark:bg-gray-700/50">
					<FontAwesomeIcon icon={faChartLine} class="mb-2 h-5 w-5 text-orange-500" />
					<p class="text-sm font-medium text-gray-800 dark:text-gray-100">Price Index</p>
					<p class="text-xs text-gray-500 dark:text-gray-400">Daily market average</p>
				</div>

				<div class="rounded-lg bg-gray-50 p-4 dark:bg-gray-700/50">
					<FontAwesomeIcon icon={faMicrochip} class="mb-2 h-5 w-5 text-purple-500" />
					<p class="text-sm font-medium text-gray-800 dark:text-gray-100">AMD vs Intel</p>
					<p class="text-xs text-gray-500 dark:text-gray-400">Price comparison</p>
				</div>

				<div class="rounded-lg bg-gray-50 p-4 dark:bg-gray-700/50">
					<FontAwesomeIcon icon={faMemory} class="mb-2 h-5 w-5 text-blue-500" />
					<p class="text-sm font-medium text-gray-800 dark:text-gray-100">RAM Pricing</p>
					<p class="text-xs text-gray-500 dark:text-gray-400">ECC vs non-ECC trends</p>
				</div>

				<div class="rounded-lg bg-gray-50 p-4 dark:bg-gray-700/50">
					<FontAwesomeIcon icon={faGlobe} class="mb-2 h-5 w-5 text-green-500" />
					<p class="text-sm font-medium text-gray-800 dark:text-gray-100">Volume by DC</p>
					<p class="text-xs text-gray-500 dark:text-gray-400">Finland vs Germany</p>
				</div>
			</div>
		</div>
	</div>
</section>
