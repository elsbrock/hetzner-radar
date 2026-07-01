<script lang="ts">
	import { faChartLine, faMemory, faMicrochip, faGlobe } from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { Button } from 'flowbite-svelte';
	import { ArrowRightOutline } from 'flowbite-svelte-icons';
	import SectionEyebrow from './SectionEyebrow.svelte';

	const highlights = [
		{
			icon: faChartLine,
			color: 'text-orange-500',
			title: 'Price Index',
			desc: 'Daily market average'
		},
		{
			icon: faMicrochip,
			color: 'text-purple-500',
			title: 'AMD vs Intel',
			desc: 'Price comparison'
		},
		{
			icon: faMemory,
			color: 'text-blue-500',
			title: 'RAM Pricing',
			desc: 'ECC vs non-ECC trends'
		},
		{
			icon: faGlobe,
			color: 'text-green-500',
			title: 'Volume by DC',
			desc: 'Finland vs Germany'
		}
	];
</script>

<section class="mx-auto my-16 max-w-5xl">
	<div
		class="relative overflow-hidden rounded-xl border border-gray-200 bg-white p-8 dark:border-gray-700 dark:bg-gray-800"
	>
		<div
			class="radar-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(120%_120%_at_0%_0%,black,transparent)]"
		></div>
		<div class="relative grid grid-cols-1 items-center gap-8 lg:grid-cols-2">
			<!-- Left: Description -->
			<div>
				<SectionEyebrow label="Market intel" />
				<div class="mt-3 mb-4 flex items-center gap-3">
					<div
						class="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30"
					>
						<FontAwesomeIcon icon={faChartLine} class="h-5 w-5 text-orange-500" />
					</div>
					<h2 class="text-2xl font-semibold text-gray-800 dark:text-gray-100">Market Statistics</h2>
				</div>
				<p class="mb-6 text-gray-600 dark:text-gray-400">
					Daily price index, AMD vs Intel and ECC vs non-ECC spreads, and listing volume by
					datacenter — useful when you want to understand the market, not just one server.
				</p>
				<Button href="/statistics" color="light" size="sm">
					View Statistics
					<ArrowRightOutline class="ms-2 h-4 w-4" />
				</Button>
			</div>

			<!-- Right: Stat highlights -->
			<div class="grid grid-cols-2 gap-4">
				{#each highlights as h (h.title)}
					<div
						class="signal-edge group rounded-lg border border-gray-100 bg-gray-50 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-gray-200 dark:border-gray-700 dark:bg-gray-700/50 dark:hover:border-gray-600"
					>
						<FontAwesomeIcon icon={h.icon} class="mb-2 h-5 w-5 {h.color}" />
						<p class="text-sm font-medium text-gray-800 dark:text-gray-100">{h.title}</p>
						<p class="text-xs text-gray-500 dark:text-gray-400">{h.desc}</p>
					</div>
				{/each}
			</div>
		</div>
	</div>
</section>
