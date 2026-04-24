<script lang="ts">
	import GenericChart from '$lib/components/GenericChart.svelte';
	import { defaultFilter, encodeFilter } from '$lib/filter';
	import { settingsStore, currencySymbol, currentCurrency } from '$lib/stores/settings';
	import { convertPrice } from '$lib/currency';
	import dayjs from 'dayjs';
	import relativeTime from 'dayjs/plugin/relativeTime';

	dayjs.extend(relativeTime);

	let { data } = $props();

	const cpu = $derived(data.cpu);
	const cheapest = $derived(data.cheapest);
	const variants = $derived(data.variants);
	const history = $derived(data.priceHistory);
	const related = $derived(data.related);

	const CANONICAL_URL = $derived(`https://radar.iodev.org/servers/cpu/${cpu.slug}`);
	const TITLE = $derived(`Hetzner ${cpu.displayName} servers — price & deals`);
	const DESCRIPTION = $derived.by(() => {
		const parts: string[] = [];
		if (cpu.cores) parts.push(`${cpu.cores} cores`);
		if (cpu.threads) parts.push(`${cpu.threads} threads`);
		if (cpu.multicoreScore) parts.push(`Geekbench 5 multicore ${cpu.multicoreScore.toLocaleString()}`);
		const specs = parts.length ? `${parts.join(', ')}.` : '';
		const price =
			data.priceMin != null
				? ` From €${data.priceMin.toFixed(2)}/mo across ${cpu.listingCount} live auction${cpu.listingCount === 1 ? '' : 's'}.`
				: ` ${cpu.listingCount} live auction${cpu.listingCount === 1 ? '' : 's'}.`;
		return `${cpu.displayName} dedicated server deals on Hetzner. ${specs}${price}`.slice(0, 158);
	});

	const cpuFilterUrl = $derived.by(() => {
		const filter = { ...defaultFilter, selectedCpuModels: [...cpu.cpus] };
		return `/analyze?filter=${encodeFilter(filter)}`;
	});

	function variantFilterUrl(v: (typeof variants)[number]): string {
		const filter = {
			...defaultFilter,
			selectedCpuModels: [...cpu.cpus],
			ramInternalSize: [Math.log2(v.ramSize), Math.log2(v.ramSize)] as [number, number],
			extrasECC: v.isEcc ? true : null,
		};
		return `/analyze?filter=${encodeFilter(filter)}`;
	}

	const timeUnit = $derived(
		($settingsStore.timeUnitPrice ?? 'perMonth') as 'perMonth' | 'perHour'
	);

	function formatPrice(eur: number): string {
		const converted = convertPrice(eur, 'EUR', $currentCurrency);
		if (timeUnit === 'perHour') return (converted / (30 * 24)).toFixed(4);
		return converted.toFixed(2);
	}

	function formatStorage(gb: number): string {
		if (gb >= 1000) {
			const tb = gb / 1000;
			return `${tb % 1 === 0 ? tb.toFixed(0) : tb.toFixed(1)} TB`;
		}
		return `${gb} GB`;
	}

	function describeStorage(v: {
		nvmeSize: number | null;
		sataSize: number | null;
		hddSize: number | null;
	}): string {
		const parts: string[] = [];
		if (v.nvmeSize) parts.push(`${formatStorage(v.nvmeSize)} NVMe`);
		if (v.sataSize) parts.push(`${formatStorage(v.sataSize)} SATA`);
		if (v.hddSize) parts.push(`${formatStorage(v.hddSize)} HDD`);
		return parts.join(' + ') || 'no storage';
	}

	const chartData = $derived([
		{
			name: 'Daily minimum',
			data: history.map((p) => ({
				x: new Date(p.day).getTime(),
				y: Number(p.minPrice.toFixed(2))
			})),
			color: '#fb923c'
		}
	]);

	const chartOptions = $derived({
		responsive: true,
		maintainAspectRatio: false,
		scales: {
			x: {
				type: 'time' as const,
				time: { unit: 'week' as const, displayFormats: { week: 'MMM d' } },
				grid: { display: false }
			},
			y: {
				beginAtZero: false,
				title: { display: true, text: 'Min price (EUR/month)' }
			}
		},
		plugins: { legend: { display: false } }
	});

	const breadcrumbJsonLd = $derived({
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: [
			{ '@type': 'ListItem', position: 1, name: 'Home', item: 'https://radar.iodev.org/' },
			{
				'@type': 'ListItem',
				position: 2,
				name: 'Servers',
				item: 'https://radar.iodev.org/servers/cpu'
			},
			{
				'@type': 'ListItem',
				position: 3,
				name: 'Browse by CPU',
				item: 'https://radar.iodev.org/servers/cpu'
			},
			{ '@type': 'ListItem', position: 4, name: cpu.displayName, item: CANONICAL_URL }
		]
	});

	const productJsonLd = $derived.by(() => {
		const props: Array<{ '@type': 'PropertyValue'; name: string; value: string | number }> = [];
		if (cpu.cores != null) props.push({ '@type': 'PropertyValue', name: 'Cores', value: cpu.cores });
		if (cpu.threads != null) props.push({ '@type': 'PropertyValue', name: 'Threads', value: cpu.threads });
		if (cpu.generation) props.push({ '@type': 'PropertyValue', name: 'Generation', value: cpu.generation });
		if (cpu.multicoreScore != null)
			props.push({ '@type': 'PropertyValue', name: 'Geekbench 5 Multicore', value: cpu.multicoreScore });
		if (cpu.score != null)
			props.push({ '@type': 'PropertyValue', name: 'Geekbench 5 Single-core', value: cpu.score });

		const offers =
			data.priceMin != null && data.priceMax != null
				? {
						'@type': 'AggregateOffer',
						priceCurrency: 'EUR',
						lowPrice: data.priceMin.toFixed(2),
						highPrice: data.priceMax.toFixed(2),
						offerCount: cpu.listingCount,
						availability: 'https://schema.org/InStock',
						url: CANONICAL_URL
					}
				: undefined;

		return {
			'@context': 'https://schema.org',
			'@type': 'Product',
			name: `Hetzner dedicated server with ${cpu.displayName}`,
			description: DESCRIPTION,
			category: 'Dedicated Server',
			brand: { '@type': 'Organization', name: 'Hetzner' },
			additionalProperty: props,
			offers
		};
	});

	function jsonLd(value: unknown): string {
		return JSON.stringify(value).replace(/</g, '\\u003c');
	}
</script>

<svelte:head>
	<title>{TITLE}</title>
	<meta name="description" content={DESCRIPTION} />
	<link rel="canonical" href={CANONICAL_URL} />
	<meta property="og:title" content={TITLE} />
	<meta property="og:description" content={DESCRIPTION} />
	<meta property="og:url" content={CANONICAL_URL} />
	<meta property="og:type" content="website" />
	<meta property="og:image" content="https://radar.iodev.org/images/og-image.webp" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={TITLE} />
	<meta name="twitter:description" content={DESCRIPTION} />
	<meta name="twitter:image" content="https://radar.iodev.org/images/og-image.webp" />

	{@html `<script type="application/ld+json">${jsonLd(breadcrumbJsonLd)}<` + `/script>`}
	{@html `<script type="application/ld+json">${jsonLd(productJsonLd)}<` + `/script>`}
</svelte:head>

<main class="mx-auto max-w-5xl p-8">
	<nav class="mb-6 text-sm text-gray-500 dark:text-gray-400">
		<a class="hover:text-orange-600" href="/">Home</a> <span class="mx-2">/</span>
		<a class="hover:text-orange-600" href="/servers/cpu">Browse by CPU</a>
		<span class="mx-2">/</span>
		<span>{cpu.displayName}</span>
	</nav>

	<h1 class="mb-3 text-4xl font-extrabold text-gray-800 dark:text-gray-100">
		Hetzner servers with {cpu.displayName}
	</h1>

	<p class="mb-8 text-lg text-gray-600 dark:text-gray-400">
		{#if cpu.cores}<strong>{cpu.cores}</strong> cores{/if}{#if cpu.threads}, <strong>{cpu.threads}</strong> threads{/if}{#if cpu.generation} · {cpu.generation}{/if}{#if cpu.multicoreScore}
			· Geekbench 5 multicore <strong>{cpu.multicoreScore.toLocaleString()}</strong>{/if}.
		{cpu.listingCount} live listing{cpu.listingCount === 1 ? '' : 's'}{#if data.priceMin != null}, from <strong>€{data.priceMin.toFixed(2)}/mo</strong>{/if}.
	</p>

	{#if cheapest}
		<section class="mb-10 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
			<h2 class="mb-2 text-sm font-semibold tracking-wide text-orange-600 uppercase">
				Cheapest right now
			</h2>
			<p class="mb-1 text-2xl font-bold text-gray-800 dark:text-gray-100">
				{formatPrice(cheapest.price)} {$currencySymbol}
				<span class="text-sm font-normal text-gray-500 dark:text-gray-400">/{timeUnit === 'perHour' ? 'hour' : 'month'} (net)</span>
			</p>
			<p class="text-sm text-gray-600 dark:text-gray-400">
				{cheapest.ramSize} GB{cheapest.isEcc ? ' ECC' : ''} RAM, {describeStorage(cheapest)}
				{#if cheapest.withGpu}· GPU{/if}
				{#if cheapest.withInic}· iNIC{/if}
				{#if cheapest.withHwr}· hardware RAID{/if}
				{#if cheapest.withRps}· redundant PSU{/if}
				{#if cheapest.datacenter} · {cheapest.datacenter}{/if}
				{#if cheapest.seenAt} · seen {dayjs.unix(cheapest.seenAt).fromNow()}{/if}
			</p>
			<a
				class="mt-4 inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-orange-600"
				href={cpuFilterUrl}
			>
				Open {cpu.displayName} listings →
			</a>
		</section>
	{/if}

	{#if history.length > 1}
		<section class="mb-10">
			<h2 class="mb-3 text-2xl font-bold text-gray-800 dark:text-gray-100">90-day price history</h2>
			<p class="mb-4 text-sm text-gray-500 dark:text-gray-400">
				Daily minimum price across all listings featuring {cpu.displayName} (incl. €{(1.7).toFixed(2)} IPv4 cost, net).
			</p>
			<div class="h-72 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
				<GenericChart data={chartData} options={chartOptions} legendShow={false} />
			</div>
		</section>
	{/if}

	{#if variants.length > 0}
		<section class="mb-10">
			<h2 class="mb-3 text-2xl font-bold text-gray-800 dark:text-gray-100">Common configurations</h2>
			<p class="mb-4 text-sm text-gray-500 dark:text-gray-400">
				Top variants by current listing count. Click to filter the auction view to that exact shape.
			</p>
			<ul class="grid grid-cols-1 gap-3 md:grid-cols-2">
				{#each variants as v (`${v.ramSize}-${v.isEcc}-${v.nvmeSize}-${v.sataSize}-${v.hddSize}`)}
					<li>
						<a
							class="flex items-center justify-between rounded-md border border-gray-200 bg-white p-4 transition hover:border-orange-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-orange-600"
							href={variantFilterUrl(v)}
						>
							<div>
								<p class="font-medium text-gray-800 dark:text-gray-100">
									{v.ramSize} GB{v.isEcc ? ' ECC' : ''}, {describeStorage(v)}
								</p>
								<p class="text-xs text-gray-500 dark:text-gray-400">
									{v.listingCount} listing{v.listingCount === 1 ? '' : 's'}
								</p>
							</div>
							<div class="text-right">
								<p class="font-semibold text-gray-800 dark:text-gray-100">
									from €{v.cheapestPrice.toFixed(2)}
								</p>
								<p class="text-xs text-gray-500 dark:text-gray-400">/month</p>
							</div>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if related.length > 0}
		<section class="mb-10">
			<h2 class="mb-3 text-2xl font-bold text-gray-800 dark:text-gray-100">Related CPUs</h2>
			<ul class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
				{#each related as r (r.slug)}
					<li>
						<a
							class="flex flex-col rounded-md border border-gray-200 bg-white p-3 text-sm transition hover:border-orange-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-orange-600"
							href={`/servers/cpu/${r.slug}`}
						>
							<span class="font-medium text-gray-800 dark:text-gray-100">{r.displayName}</span>
							<span class="text-xs text-gray-500 dark:text-gray-400">
								{#if r.multicoreScore}GB5 {r.multicoreScore.toLocaleString()} ·{/if}
								{r.listingCount} live
							</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<section class="mt-12 border-t border-gray-200 pt-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
		<a class="text-orange-600 hover:text-orange-700" href="/servers/cpu">← All CPUs</a>
		<span class="mx-3">·</span>
		<a class="text-orange-600 hover:text-orange-700" href="/configurations">Today's best deals</a>
	</section>
</main>
