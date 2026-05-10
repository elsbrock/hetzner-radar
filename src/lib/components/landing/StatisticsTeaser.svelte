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

<section class="mx-auto my-20 max-w-5xl">
	<div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
		<div class="grid grid-cols-1 lg:grid-cols-2">
			<!-- Left: Description -->
			<div class="p-8 lg:p-10">
				<span class="mb-4 inline-block rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:bg-gray-700 dark:text-gray-300">
					Market Intelligence
				</span>
				<h2 class="mb-4 text-2xl font-bold text-gray-900 dark:text-gray-50">Understand the market, not just one server</h2>
				<p class="mb-6 leading-relaxed text-gray-600 dark:text-gray-400">
					Daily price index, AMD vs Intel spreads, ECC vs non-ECC premiums, and listing volume by datacenter. Make data-driven decisions about when and what to buy.
				</p>
				<Button href="/statistics" color="light" size="sm">
					View Statistics
					<ArrowRightOutline class="ms-2 h-4 w-4" />
				</Button>
			</div>

			<!-- Right: Stat highlights -->
			<div class="grid grid-cols-2 gap-px bg-gray-200 dark:bg-gray-700">
				<div class="flex flex-col items-center justify-center bg-gray-50 p-6 text-center dark:bg-gray-800/80">
					<FontAwesomeIcon icon={faChartLine} class="mb-3 h-6 w-6 text-orange-500" />
					<p class="font-semibold text-gray-900 dark:text-gray-100">Price Index</p>
					<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Daily market average</p>
				</div>

				<div class="flex flex-col items-center justify-center bg-gray-50 p-6 text-center dark:bg-gray-800/80">
					<FontAwesomeIcon icon={faMicrochip} class="mb-3 h-6 w-6 text-orange-500" />
					<p class="font-semibold text-gray-900 dark:text-gray-100">AMD vs Intel</p>
					<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Price comparison</p>
				</div>

				<div class="flex flex-col items-center justify-center bg-gray-50 p-6 text-center dark:bg-gray-800/80">
					<FontAwesomeIcon icon={faMemory} class="mb-3 h-6 w-6 text-orange-500" />
					<p class="font-semibold text-gray-900 dark:text-gray-100">RAM Pricing</p>
					<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">ECC vs non-ECC trends</p>
				</div>

				<div class="flex flex-col items-center justify-center bg-gray-50 p-6 text-center dark:bg-gray-800/80">
					<FontAwesomeIcon icon={faGlobe} class="mb-3 h-6 w-6 text-orange-500" />
					<p class="font-semibold text-gray-900 dark:text-gray-100">Volume by DC</p>
					<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Finland vs Germany</p>
				</div>
			</div>
		</div>
	</div>
</section>
