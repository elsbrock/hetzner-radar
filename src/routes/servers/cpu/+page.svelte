<script lang="ts">
	import type { EligibleCpu } from '$lib/api/shared/cpu-pages';

	let { data } = $props();

	const CANONICAL_URL = 'https://radar.iodev.org/servers/cpu';
	const PAGE_TITLE = 'Browse Hetzner Servers by CPU — Server Radar';
	const PAGE_DESCRIPTION =
		'Live Hetzner dedicated server auctions grouped by CPU model. Pick a CPU to see current price, 90-day history and common configurations.';

	const grouped = $derived.by(() => {
		const map: Record<'AMD' | 'Intel' | 'Other', EligibleCpu[]> = {
			AMD: [],
			Intel: [],
			Other: []
		};
		for (const cpu of data.cpus) {
			map[cpu.vendor].push(cpu);
		}
		return map;
	});

	const total = $derived(data.cpus.length);

	const breadcrumbJsonLd = {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: [
			{ '@type': 'ListItem', position: 1, name: 'Home', item: 'https://radar.iodev.org/' },
			{ '@type': 'ListItem', position: 2, name: 'Servers', item: 'https://radar.iodev.org/servers/cpu' },
			{ '@type': 'ListItem', position: 3, name: 'Browse by CPU', item: CANONICAL_URL }
		]
	};

	const itemListJsonLd = $derived({
		'@context': 'https://schema.org',
		'@type': 'ItemList',
		name: 'Hetzner servers by CPU',
		numberOfItems: data.cpus.length,
		itemListElement: data.cpus.map((cpu, i) => ({
			'@type': 'ListItem',
			position: i + 1,
			url: `${CANONICAL_URL}/${cpu.slug}`,
			name: cpu.displayName
		}))
	});

	function jsonLd(value: unknown): string {
		return JSON.stringify(value).replace(/</g, '\\u003c');
	}
</script>

<svelte:head>
	<title>{PAGE_TITLE}</title>
	<meta name="description" content={PAGE_DESCRIPTION} />
	<link rel="canonical" href={CANONICAL_URL} />
	<meta property="og:title" content={PAGE_TITLE} />
	<meta property="og:description" content={PAGE_DESCRIPTION} />
	<meta property="og:url" content={CANONICAL_URL} />
	<meta property="og:type" content="website" />
	<meta property="og:image" content="https://radar.iodev.org/images/og-image.webp" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={PAGE_TITLE} />
	<meta name="twitter:description" content={PAGE_DESCRIPTION} />
	<meta name="twitter:image" content="https://radar.iodev.org/images/og-image.webp" />

	{@html `<script type="application/ld+json">${jsonLd(breadcrumbJsonLd)}<` + `/script>`}
	{@html `<script type="application/ld+json">${jsonLd(itemListJsonLd)}<` + `/script>`}
</svelte:head>

<main class="mx-auto max-w-5xl p-8">
	<nav class="mb-6 text-sm text-gray-500 dark:text-gray-400">
		<a class="hover:text-orange-600" href="/">Home</a> <span class="mx-2">/</span>
		<span>Browse by CPU</span>
	</nav>

	<h1 class="mb-3 text-4xl font-extrabold text-gray-800 dark:text-gray-100">
		Browse Hetzner servers by CPU
	</h1>
	<p class="mb-10 text-gray-600 dark:text-gray-400">
		One page per CPU model with the current cheapest price, common configurations and 90 days of price
		history. {total} models tracked across the live auction.
	</p>

	{#each ['AMD', 'Intel', 'Other'] as vendor (vendor)}
		{@const cpus = grouped[vendor as 'AMD' | 'Intel' | 'Other']}
		{#if cpus.length > 0}
			<section class="mb-10">
				<h2 class="mb-4 text-2xl font-bold text-gray-800 dark:text-gray-100">{vendor}</h2>
				<ul class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
					{#each cpus as cpu (cpu.slug)}
						<li>
							<a
								class="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm transition-colors hover:border-orange-300 hover:bg-orange-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-orange-600 dark:hover:bg-orange-900/20"
								href={`/servers/cpu/${cpu.slug}`}
							>
								<span class="font-medium text-gray-800 dark:text-gray-100">{cpu.displayName}</span>
								<span class="text-xs text-gray-500 dark:text-gray-400">
									{cpu.listingCount} live
								</span>
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	{/each}

	{#if total === 0}
		<div class="rounded-lg border border-dashed border-gray-200 bg-white/50 p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-400">
			No CPU data available yet. Check back once the next auction snapshot is imported.
		</div>
	{/if}
</main>
