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
	import SectionEyebrow from './SectionEyebrow.svelte';

	const categories = [
		{
			href: '/configurations#price-performance',
			icon: faBolt,
			title: 'Best price/performance',
			desc: 'Lowest € per Geekbench 5 multicore point',
			metric: '€/pt',
			accent:
				'hover:border-amber-300 hover:bg-amber-50 dark:hover:border-amber-600 dark:hover:bg-amber-900/20',
			iconColor: 'text-amber-500'
		},
		{
			href: '/configurations#affordable',
			icon: faServer,
			title: 'Cheapest absolute',
			desc: 'Lowest monthly price with a usable CPU floor',
			metric: '€/mo',
			accent:
				'hover:border-orange-300 hover:bg-orange-50 dark:hover:border-orange-600 dark:hover:bg-orange-900/20',
			iconColor: 'text-orange-500'
		},
		{
			href: '/configurations#ram',
			icon: faMemory,
			title: 'Best € per GB RAM',
			desc: 'For VMs, in-memory caches, large databases',
			metric: '€/GB',
			accent:
				'hover:border-purple-300 hover:bg-purple-50 dark:hover:border-purple-600 dark:hover:bg-purple-900/20',
			iconColor: 'text-purple-500'
		},
		{
			href: '/configurations#nvme',
			icon: faHardDrive,
			title: 'Best € per TB NVMe',
			desc: 'Hot storage for OLTP, build caches, indexes',
			metric: '€/TB',
			accent:
				'hover:border-green-300 hover:bg-green-50 dark:hover:border-green-600 dark:hover:bg-green-900/20',
			iconColor: 'text-green-500'
		},
		{
			href: '/configurations#storage',
			icon: faDatabase,
			title: 'Best € per TB bulk',
			desc: 'SATA + HDD for backups, archives, media',
			metric: '€/TB',
			accent:
				'hover:border-blue-300 hover:bg-blue-50 dark:hover:border-blue-600 dark:hover:bg-blue-900/20',
			iconColor: 'text-blue-500'
		}
	];
</script>

<section class="mx-auto my-16 max-w-5xl">
	<div class="mb-8 text-center">
		<SectionEyebrow label="Live rankings" live />
		<h2 class="mt-3 mb-4 text-2xl font-semibold text-gray-800 dark:text-gray-100">
			Top deals by category
		</h2>
		<p class="mx-auto max-w-2xl text-gray-600 dark:text-gray-400">
			Live rankings of current auction listings, scored against the metric that matters for each
			workload. Updated every few minutes.
		</p>
	</div>

	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
		{#each categories as cat (cat.href)}
			<a
				href={cat.href}
				class="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 {cat.accent}"
			>
				<div class="mb-2 flex items-center justify-between">
					<FontAwesomeIcon icon={cat.icon} class="h-6 w-6 {cat.iconColor}" />
					<span
						class="font-mono text-[10px] tracking-widest text-gray-400 uppercase dark:text-gray-500"
					>
						{cat.metric}
					</span>
				</div>
				<h3 class="font-medium text-gray-800 dark:text-gray-100">{cat.title}</h3>
				<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{cat.desc}</p>
			</a>
		{/each}
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
