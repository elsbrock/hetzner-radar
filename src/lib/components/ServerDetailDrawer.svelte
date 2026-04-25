<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { withDbConnections } from '$lib/api/frontend/dbapi';
	import type { ServerConfiguration, ServerPriceStat } from '$lib/api/frontend/filter';
	import { getPrices } from '$lib/api/frontend/filter';
	import { getFormattedDiskSize } from '$lib/disksize';
	import { convertServerConfigurationToFilter, getHetznerLink } from '$lib/filter';
	import { filter } from '$lib/stores/filter';
	import { settingsStore, currencySymbol, currentCurrency } from '$lib/stores/settings';
	import { convertPrice } from '$lib/currency';
	import {
		faArrowDown,
		faChartLine,
		faDisplay,
		faExternalLinkAlt,
		faFilter,
		faFire,
		faGaugeHigh,
		faGavel,
		faHardDrive,
		faLayerGroup,
		faMemory,
		faMicrochip,
		faNetworkWired,
		faPlug,
		faSdCard,
		faShieldHalved,
		faShoppingCart
	} from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon as Fa } from '@fortawesome/svelte-fontawesome';
	import dayjs from 'dayjs';
	import { Button, CloseButton, Drawer, Tooltip } from 'flowbite-svelte';
	import { sineIn } from 'svelte/easing';
	import { db } from '../../stores/db';
	import ServerPriceChart from './ServerPriceChart.svelte';
	import { vatOptions } from './VatSelector.svelte';
	import type { LiveAuctionResult } from '../../routes/api/auctions/+server';

	interface _$Props {
		config?: ServerConfiguration | null;
		hidden?: boolean;
	}
	let { config = null, hidden = $bindable(true) } = $props();

	let transitionParamsRight = {
		x: 320,
		duration: 200,
		easing: sineIn
	};

	let auctions = $state<LiveAuctionResult[]>([]);
	let loadingAuctions = $state(false);

	$effect(() => {
		const currentConfig = config;
		const currentFilter = $filter;

		if (currentConfig?.server_type === 'standard') {
			auctions = [];
			loadingAuctions = false;
			return;
		}

		if (currentConfig && currentFilter) {
			loadingAuctions = true;
			auctions = [];
			let cancelled = false;

			(async () => {
				try {
					const response = await fetch('/api/auctions', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							cpu: currentConfig.cpu,
							ram_size: currentConfig.ram_size,
							is_ecc: currentConfig.is_ecc,
							nvme_drives: currentConfig.nvme_drives,
							sata_drives: currentConfig.sata_drives,
							hdd_drives: currentConfig.hdd_drives,
							with_inic: currentConfig.with_inic,
							with_gpu: currentConfig.with_gpu,
							with_hwr: currentConfig.with_hwr,
							with_rps: currentConfig.with_rps,
							locationGermany: currentFilter.locationGermany,
							locationFinland: currentFilter.locationFinland,
							selectedDatacenters: currentFilter.selectedDatacenters
						})
					});

					if (!cancelled && response.ok) {
						const data = await response.json();
						auctions = data.auctions ?? [];
					}
				} catch (error) {
					console.error('Error fetching auctions:', error);
					if (!cancelled) {
						auctions = [];
					}
				} finally {
					if (!cancelled) {
						loadingAuctions = false;
					}
				}
			})();

			return () => {
				cancelled = true;
			};
		} else {
			auctions = [];
			loadingAuctions = false;
		}
	});

	function closeDrawer() {
		hidden = true;
	}

	type VatCountryCode = keyof typeof vatOptions;

	const countryCode = $derived($settingsStore.vatSelection?.countryCode);
	const validCountryCode = $derived(
		countryCode && countryCode in vatOptions ? (countryCode as VatCountryCode) : 'NET'
	);
	const selectedOption = $derived(
		config ? vatOptions[validCountryCode as VatCountryCode] : vatOptions['NET']
	);
	const priceWithVat = $derived(config ? (config.price ?? 0) * (1 + selectedOption.rate) : 0);
	const displayPrice = $derived(convertPrice(priceWithVat, 'EUR', $currentCurrency));
	const vatLabel = $derived(
		selectedOption.rate > 0 ? `incl. ${(selectedOption.rate * 100).toFixed(0)}% VAT` : 'net price'
	);
	const selectedTimeUnit = $derived(
		($settingsStore.timeUnitPrice ?? 'perMonth') as 'perMonth' | 'perHour'
	);

	// State / derived
	const isAuction = $derived(!!config && config.server_type !== 'standard');
	const isBestDeal = $derived(
		isAuction &&
			config?.markup_percentage !== undefined &&
			config?.markup_percentage !== null &&
			config.markup_percentage <= 0
	);
	const isFresh = $derived(
		!!config?.last_seen && dayjs.unix(config.last_seen) > dayjs().subtract(80, 'minutes')
	);

	let serverPrices = $state<ServerPriceStat[]>([]);
	let loadingPrices = $state(true);

	const lowestPriceRecord = $derived(
		serverPrices.length > 0
			? serverPrices.reduce((min, p) => (p.min_price < min.min_price ? p : min), serverPrices[0])
			: null
	);
	const lowestPrice = $derived(lowestPriceRecord?.min_price ?? null);
	const lowestPriceDate = $derived(
		lowestPriceRecord?.seen ? dayjs.unix(lowestPriceRecord.seen) : null
	);
	const averageSupply = $derived(
		serverPrices.length > 0
			? Math.round(serverPrices.reduce((sum, p) => sum + p.count, 0) / serverPrices.length)
			: null
	);
	const currentSupply = $derived(
		serverPrices.length > 0 ? (serverPrices[serverPrices.length - 1]?.count ?? null) : null
	);
	const supplyTrend = $derived(
		averageSupply !== null && currentSupply !== null && averageSupply > 0
			? Math.round(((currentSupply - averageSupply) / averageSupply) * 100)
			: null
	);

	$effect(() => {
		const currentConfig = config;
		const currentDb = $db;

		if (currentConfig && currentDb) {
			loadingPrices = true;
			let cancelled = false;

			(async () => {
				try {
					await withDbConnections(currentDb, async (conn) => {
						const prices = await getPrices(
							conn,
							convertServerConfigurationToFilter(currentConfig)
						);
						if (!cancelled) {
							serverPrices = prices;
						}
					});
				} catch (error) {
					console.error('Error fetching server prices:', error);
					if (!cancelled) {
						serverPrices = [];
					}
				} finally {
					if (!cancelled) {
						loadingPrices = false;
					}
				}
			})();

			return () => {
				cancelled = true;
			};
		} else {
			serverPrices = [];
			loadingPrices = false;
		}
	});

	// Storage rendering helpers (mirror ServerCard logic)
	function summarize(arr: number[]) {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const counts = new Map<number, number>();
		for (const v of arr) counts.set(v, (counts.get(v) || 0) + 1);
		return Array.from(counts.entries())
			.map(([value, count]) => ({ count, value }))
			.sort((a, b) => a.value - b.value);
	}
	function formatDriveLine(arr: number[]) {
		const summary = summarize(arr);
		return summary
			.map((s) =>
				summary.length > 1 || s.count > 1
					? `${s.count}× ${getFormattedDiskSize(s.value)}`
					: getFormattedDiskSize(s.value)
			)
			.join(' + ');
	}
	function totalTb(arr: number[]) {
		return arr.reduce((s, v) => s + v, 0) / 1000;
	}
	function buildStorageRow(
		label: string,
		drives: number[] | undefined | null,
		totalGb: number | null | undefined
	) {
		if (drives && drives.length > 0) {
			const tb = totalTb(drives);
			return {
				label,
				text: formatDriveLine(drives),
				pricePerTb: tb > 0 ? displayPrice / tb : 0
			};
		}
		if (totalGb && totalGb > 0) {
			const tb = totalGb / 1000;
			return {
				label,
				text: getFormattedDiskSize(totalGb),
				pricePerTb: tb > 0 ? displayPrice / tb : 0
			};
		}
		return null;
	}

	const storageRows = $derived(
		!config
			? []
			: ([
					buildStorageRow('NVMe', config.nvme_drives, config.nvme_size),
					buildStorageRow('SATA', config.sata_drives, config.sata_size),
					buildStorageRow('HDD', config.hdd_drives, config.hdd_size)
				].filter(Boolean) as { label: string; text: string; pricePerTb: number }[])
	);
	const storageIcon = $derived(
		(config?.nvme_drives?.length ?? 0) > 0 || (config?.nvme_size ?? 0) > 0
			? faSdCard
			: faHardDrive
	);
	const ramPricePerGb = $derived(
		config && (config.ram_size ?? 0) > 0 ? displayPrice / (config.ram_size as number) : 0
	);

	const extras = $derived(
		!config
			? []
			: ([
					config.is_ecc && { label: 'ECC', icon: faShieldHalved, title: 'ECC memory' },
					config.with_inic && { label: 'iNIC', icon: faNetworkWired, title: 'Intel NIC (10G)' },
					config.with_gpu && { label: 'GPU', icon: faDisplay, title: 'GPU' },
					config.with_hwr && { label: 'HWR', icon: faLayerGroup, title: 'Hardware RAID' },
					config.with_rps && { label: 'RPS', icon: faPlug, title: 'Redundant power supply' }
				].filter(Boolean) as { label: string; icon: typeof faShieldHalved; title: string }[])
	);

	function compact(n: number): string {
		if (n >= 10000) return Math.round(n / 1000) + 'k';
		if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
		return n.toString();
	}
</script>

<Drawer
	bind:hidden
	backdrop={true}
	bgOpacity="bg-black/25"
	placement="right"
	transitionType="fly"
	transitionParams={transitionParamsRight}
	id="server-detail-drawer"
	width="w-96"
	class="border-l border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
>
	<!-- Best-deal accent stripe -->
	{#if isBestDeal}
		<div
			class="-mx-4 -mt-4 mb-3 h-[3px] bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400"
		></div>
	{/if}

	{#if config}
		<!-- Chrome strip: freshness · type · close -->
		<div class="mb-3 flex items-center justify-between text-[10px]">
			<div class="flex items-center gap-2">
				<span class="inline-flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
					<span class="relative flex h-1.5 w-1.5">
						{#if isFresh}
							<span
								class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60"
							></span>
						{/if}
						<span
							class={`relative inline-flex h-1.5 w-1.5 rounded-full ${isFresh ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}
						></span>
					</span>
					<span class="tabular-nums">
						{config.last_seen ? dayjs.unix(config.last_seen).fromNow() : 'never'}
					</span>
				</span>
				{#if isBestDeal}
					<span
						class="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
					>
						<Fa icon={faFire} class="h-2.5 w-2.5" />
						Best deal
					</span>
				{:else if isAuction}
					<span
						class="rounded-full px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase text-zinc-500 dark:text-zinc-400"
					>
						Auction
					</span>
				{:else}
					<span
						class="rounded-full px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase text-zinc-500 dark:text-zinc-400"
					>
						Standard
					</span>
				{/if}
			</div>
			<CloseButton onclick={closeDrawer} class="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300" />
		</div>

		<!-- Title -->
		<div class="mb-4 flex items-start justify-between gap-2">
			<div class="min-w-0 flex-1">
				<h3
					class="truncate font-mono text-base leading-tight font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
					title={config.cpu}
				>
					{config.cpu}
				</h3>
				{#if config.cpu_generation}
					<p class="mt-1 truncate text-xs text-zinc-400 dark:text-zinc-500">
						{config.cpu_generation}
					</p>
				{/if}
			</div>
			<Button
				size="xs"
				color="alternative"
				class="shrink-0"
				onclick={() => {
					const currentConfig = config;
					if (currentConfig) {
						const newFilter = convertServerConfigurationToFilter(currentConfig);
						filter.set(newFilter);
						if (window.location.pathname !== '/analyze') {
							goto(resolve('/analyze'));
							return;
						}
						closeDrawer();
					}
				}}
				aria-label="Apply configuration to filter"
			>
				<Fa icon={faFilter} />
			</Button>
			<Tooltip placement="bottom" class="z-50">Apply configuration to filter</Tooltip>
		</div>

		<!-- Hero price -->
		<div class="mb-4">
			<div class="flex items-baseline gap-1.5 leading-none">
				<span
					class="text-3xl font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50"
				>
					{#if selectedTimeUnit === 'perMonth'}
						{displayPrice.toFixed(2)}
					{:else}
						{(displayPrice / (30 * 24)).toFixed(4)}
					{/if}
				</span>
				<span class="text-base font-medium text-zinc-500 dark:text-zinc-400"
					>{$currencySymbol}</span
				>
				<span class="text-xs text-zinc-400 dark:text-zinc-500"
					>/{selectedTimeUnit === 'perMonth' ? 'mo' : 'hr'}</span
				>
			</div>
			<div class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
				{vatLabel}
				{#if config.server_type === 'standard' && config.setup_price && config.setup_price > 0}
					<span class="mx-1 text-zinc-300 dark:text-zinc-600">·</span>
					<span class="whitespace-nowrap tabular-nums"
						>+{convertPrice(
							config.setup_price * (1 + selectedOption.rate),
							'EUR',
							$currentCurrency
						).toFixed(0)}
						{$currencySymbol} setup</span
					>
				{/if}
			</div>
		</div>

		<!-- Price chart (auctions only) -->
		{#if isAuction}
			<div class="-mx-2 mb-4 h-20">
				<ServerPriceChart
					data={serverPrices}
					loading={loadingPrices}
					toolbarShow={false}
					legendShow={false}
					timeUnitPrice={selectedTimeUnit}
				/>
			</div>

			<!-- Auction stats: lowest + supply -->
			<div class="mb-4 grid grid-cols-2 gap-1.5">
				<div
					class="rounded-lg bg-zinc-50 px-2.5 py-1.5 ring-1 ring-zinc-100 dark:bg-zinc-800/50 dark:ring-zinc-700/40"
				>
					<div class="flex items-center gap-1.5">
						<Fa icon={faArrowDown} class="h-3 w-3 text-emerald-500" />
						<span
							class="font-mono text-sm leading-tight font-semibold tabular-nums text-zinc-900 dark:text-zinc-100"
						>
							{lowestPrice !== null
								? convertPrice(
										lowestPrice * (1 + selectedOption.rate),
										'EUR',
										$currentCurrency
									).toFixed(2)
								: '—'}
						</span>
					</div>
					<div class="mt-0.5 text-[9px] text-zinc-400 dark:text-zinc-500">
						lowest{#if lowestPriceDate} · {lowestPriceDate.format('MMM D')}{/if}
					</div>
				</div>

				<div
					class="rounded-lg bg-zinc-50 px-2.5 py-1.5 ring-1 ring-zinc-100 dark:bg-zinc-800/50 dark:ring-zinc-700/40"
				>
					<div class="flex items-center gap-1.5">
						<Fa icon={faChartLine} class="h-3 w-3 text-sky-500" />
						<span
							class="font-mono text-sm leading-tight font-semibold tabular-nums text-zinc-900 dark:text-zinc-100"
						>
							{averageSupply !== null ? averageSupply : '—'}
						</span>
						{#if supplyTrend !== null && supplyTrend !== 0}
							<span
								class={`text-[10px] font-medium tabular-nums ${supplyTrend > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}
								>{supplyTrend > 0 ? '+' : ''}{supplyTrend}%</span
							>
						{/if}
					</div>
					<div class="mt-0.5 text-[9px] text-zinc-400 dark:text-zinc-500">avg supply / day</div>
				</div>
			</div>
		{/if}

		<!-- Stat tiles: 2x2 (matches ServerCard) -->
		<div class="mb-3 grid grid-cols-2 gap-1.5">
			<!-- Cores / threads -->
			<div
				class="relative rounded-lg bg-zinc-50 px-2.5 py-1.5 ring-1 ring-zinc-100 dark:bg-zinc-800/50 dark:ring-zinc-700/40"
			>
				<Fa
					icon={faMicrochip}
					class="absolute top-1.5 right-1.5 h-3 w-3 text-zinc-300 dark:text-zinc-600"
				/>
				<div
					class="overflow-hidden pr-5 font-mono text-sm leading-tight font-semibold tabular-nums whitespace-nowrap text-zinc-900 dark:text-zinc-100"
				>
					{config.cpu_cores ?? '?'}<span class="text-zinc-300 dark:text-zinc-600"
						>/</span
					>{config.cpu_threads ?? '?'}
				</div>
				<div class="text-[9px] tracking-wide text-zinc-400 dark:text-zinc-500">cores · threads</div>
			</div>

			<!-- RAM -->
			<div
				class="relative rounded-lg bg-zinc-50 px-2.5 py-1.5 ring-1 ring-zinc-100 dark:bg-zinc-800/50 dark:ring-zinc-700/40"
			>
				<Fa
					icon={faMemory}
					class="absolute top-1.5 right-1.5 h-3 w-3 text-zinc-300 dark:text-zinc-600"
				/>
				<div
					class="overflow-hidden pr-5 font-mono text-sm leading-tight font-semibold tabular-nums whitespace-nowrap text-zinc-900 dark:text-zinc-100"
				>
					{config.ram_size}<span class="ml-0.5 text-xs font-medium text-zinc-400 dark:text-zinc-500"
						>GB</span
					>
				</div>
				<div class="text-[9px] tabular-nums text-zinc-400 dark:text-zinc-500">
					{ramPricePerGb > 0 ? `${ramPricePerGb.toFixed(2)} ${$currencySymbol}/GB` : 'memory'}
				</div>
			</div>

			<!-- Storage -->
			<div
				class="relative rounded-lg bg-zinc-50 px-2.5 py-1.5 ring-1 ring-zinc-100 dark:bg-zinc-800/50 dark:ring-zinc-700/40"
			>
				<Fa
					icon={storageIcon}
					class="absolute top-1.5 right-1.5 h-3 w-3 text-zinc-300 dark:text-zinc-600"
				/>
				{#if storageRows.length === 0}
					<div
						class="truncate pr-5 font-mono text-xs leading-tight font-semibold text-zinc-400 dark:text-zinc-500"
					>
						—
					</div>
					<div class="text-[9px] text-zinc-400 dark:text-zinc-500">no storage</div>
				{:else if storageRows.length === 1}
					<div
						class="truncate pr-5 font-mono text-xs leading-tight font-semibold tabular-nums text-zinc-900 dark:text-zinc-100"
						title={storageRows[0].text}
					>
						{storageRows[0].text}
					</div>
					<div class="truncate text-[9px] tabular-nums text-zinc-400 dark:text-zinc-500">
						{storageRows[0].label.toLowerCase()}{storageRows[0].pricePerTb > 0
							? ` · ${storageRows[0].pricePerTb.toFixed(0)} ${$currencySymbol}/TB`
							: ''}
					</div>
				{:else}
					{#each storageRows as row (row.label)}
						<div
							class="truncate pr-5 font-mono text-[10px] leading-tight font-semibold tabular-nums text-zinc-900 dark:text-zinc-100"
							title={`${row.text} ${row.label}`}
						>
							{row.text}<span
								class="ml-0.5 text-[9px] font-medium lowercase text-zinc-400 dark:text-zinc-500"
								>{row.label}</span
							>
						</div>
					{/each}
				{/if}
			</div>

			<!-- Performance (GB6) -->
			<div
				class="relative rounded-lg bg-zinc-50 px-2.5 py-1.5 ring-1 ring-zinc-100 dark:bg-zinc-800/50 dark:ring-zinc-700/40"
			>
				<Fa
					icon={faGaugeHigh}
					class="absolute top-1.5 right-1.5 h-3 w-3 text-zinc-300 dark:text-zinc-600"
				/>
				<div
					class="overflow-hidden pr-5 font-mono text-sm leading-tight font-semibold tabular-nums whitespace-nowrap text-zinc-900 dark:text-zinc-100"
				>
					{#if config.cpu_score || config.cpu_multicore_score}
						<span class={config.cpu_score ? '' : 'text-zinc-400 dark:text-zinc-500'}
							>{config.cpu_score ? compact(config.cpu_score) : '—'}</span
						><span class="text-zinc-300 dark:text-zinc-600">/</span><span
							class={config.cpu_multicore_score ? '' : 'text-zinc-400 dark:text-zinc-500'}
							>{config.cpu_multicore_score ? compact(config.cpu_multicore_score) : '—'}</span
						>
					{:else}
						<span class="text-zinc-400 dark:text-zinc-500">—</span>
					{/if}
				</div>
				<div class="text-[9px] tabular-nums text-zinc-400 dark:text-zinc-500">
					GB6 single · multi
				</div>
			</div>
		</div>

		<!-- Extras chips -->
		{#if extras.length > 0}
			<div class="mb-4 flex flex-wrap gap-1">
				{#each extras as ext (ext.label)}
					<span
						class="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
						title={ext.title}
					>
						<Fa icon={ext.icon} class="h-2.5 w-2.5 text-zinc-400 dark:text-zinc-500" />
						{ext.label}
					</span>
				{/each}
			</div>
		{/if}

		<!-- Standard server: order CTA -->
		{#if config.server_type === 'standard'}
			<div
				class="mb-4 rounded-lg bg-zinc-50 p-3 ring-1 ring-zinc-100 dark:bg-zinc-800/50 dark:ring-zinc-700/40"
			>
				{#if config.datacenter}
					<div class="mb-2 flex items-baseline justify-between text-xs">
						<span class="text-zinc-500 dark:text-zinc-400">Datacenter</span>
						<span class="font-mono font-medium text-zinc-900 dark:text-zinc-100"
							>{config.datacenter}</span
						>
					</div>
				{/if}
				<p class="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
					Standard server with fixed pricing — always available from Hetzner.
				</p>
				<Button
					href={`https://www.hetzner.com/dedicated-rootserver?utm_source=server-radar&utm_medium=referral&utm_campaign=standard-server#search=${config.information?.[0] ?? ''}`}
					target="_blank"
					rel="noopener noreferrer"
					color="primary"
					class="w-full"
					size="sm"
				>
					<Fa icon={faShoppingCart} class="mr-2" />
					Order from Hetzner
				</Button>
			</div>
		{:else}
			<!-- Auctions section -->
			<div class="mb-2 flex items-center justify-between">
				<h6
					class="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.12em] text-zinc-400 uppercase dark:text-zinc-500"
				>
					<Fa icon={faGavel} class="h-3 w-3" />
					Live auctions
				</h6>
				<Button
					href={getHetznerLink(config)}
					target="_blank"
					rel="noopener noreferrer"
					size="xs"
					color="alternative"
					aria-label="Search on Hetzner"
				>
					<Fa icon={faExternalLinkAlt} />
				</Button>
				<Tooltip placement="bottom" class="z-50">Search on Hetzner with this configuration</Tooltip>
			</div>

			{#if loadingAuctions}
				<div class="space-y-1.5">
					{#each Array(3) as _, i (i)}
						<div
							class="h-12 animate-pulse rounded-lg bg-zinc-50 ring-1 ring-zinc-100 dark:bg-zinc-800/50 dark:ring-zinc-700/40"
						></div>
					{/each}
				</div>
			{:else if auctions.length > 0}
				<div class="space-y-1.5">
					{#each auctions.slice(0, 5) as auction (auction.id)}
						<a
							href={`https://www.hetzner.com/sb/?utm_source=server-radar&utm_medium=referral&utm_campaign=auction#search=${auction.id}`}
							target="_blank"
							rel="noopener noreferrer"
							class="group flex items-center justify-between gap-2 rounded-lg bg-zinc-50 px-2.5 py-2 ring-1 ring-zinc-100 transition-colors hover:bg-zinc-100 hover:ring-zinc-200 dark:bg-zinc-800/50 dark:ring-zinc-700/40 dark:hover:bg-zinc-800 dark:hover:ring-zinc-700"
						>
							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-1.5">
									<span class="relative flex h-1.5 w-1.5">
										{#if dayjs.unix(auction.lastSeen ?? 0) > dayjs().subtract(80, 'minutes')}
											<span
												class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60"
											></span>
											<span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500"
											></span>
										{:else}
											<span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600"
											></span>
										{/if}
									</span>
									<span
										class="font-mono text-xs font-medium tabular-nums text-zinc-900 dark:text-zinc-100"
										>#{auction.id}</span
									>
									<span class="text-[10px] text-zinc-400 dark:text-zinc-500"
										>· {auction.datacenter}</span
									>
								</div>
								<div class="mt-0.5 text-[10px] text-zinc-400 dark:text-zinc-500">
									{auction.lastSeen ? dayjs.unix(auction.lastSeen).fromNow() : 'unknown'}
								</div>
							</div>
							<div class="text-right">
								<div
									class="font-mono text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100"
								>
									{convertPrice(
										auction.lastPrice * (1 + selectedOption.rate),
										'EUR',
										$currentCurrency
									).toFixed(2)}
									<span class="text-[10px] font-normal text-zinc-400 dark:text-zinc-500"
										>{$currencySymbol}</span
									>
								</div>
								<Fa
									icon={faExternalLinkAlt}
									class="ml-auto h-2.5 w-2.5 text-zinc-300 group-hover:text-zinc-500 dark:text-zinc-600 dark:group-hover:text-zinc-400"
								/>
							</div>
						</a>
					{/each}
				</div>
				{#if auctions.length > 5}
					<p class="mt-2 text-[10px] text-zinc-400 dark:text-zinc-500">
						Showing 5 most recent of {auctions.length} matching auctions.
					</p>
				{/if}
			{:else}
				<div
					class="rounded-lg border border-dashed border-zinc-200 px-3 py-4 text-center dark:border-zinc-700"
				>
					<p class="text-xs text-zinc-400 dark:text-zinc-500">No matching auctions found.</p>
				</div>
			{/if}
		{/if}

		<!-- Fine print -->
		<div class="mt-5 border-t border-zinc-100 pt-3 text-[10px] leading-relaxed text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
			{#if config.server_type === 'standard'}
				<p>
					Prices include VAT based on your selection. Hetzner's final price may vary based on
					configuration options.
				</p>
			{:else}
				<p>
					Hetzner search results depend on availability and may differ. Prices include VAT based on
					your selection; Hetzner's final price may vary. Provided as-is, no warranty.
				</p>
			{/if}
		</div>
	{:else}
		<div class="flex h-full items-center justify-center">
			<p class="text-sm text-zinc-400 dark:text-zinc-500">No server selected.</p>
		</div>
	{/if}
</Drawer>
