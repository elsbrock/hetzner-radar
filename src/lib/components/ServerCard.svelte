<script lang="ts">
	import { type ServerConfiguration } from '$lib/api/frontend/filter';
	import { settingsStore, currencySymbol, currentCurrency } from '$lib/stores/settings';
	import { convertPrice } from '$lib/currency';
	import { getFormattedDiskSize } from '$lib/disksize';
	import dayjs from 'dayjs';
	import relativeTime from 'dayjs/plugin/relativeTime';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faDisplay,
		faFire,
		faGaugeHigh,
		faHardDrive,
		faLayerGroup,
		faMemory,
		faMicrochip,
		faNetworkWired,
		faPlug,
		faSdCard,
		faShieldHalved
	} from '@fortawesome/free-solid-svg-icons';
	import ServerDetailDrawer from './ServerDetailDrawer.svelte';
	import { vatOptions } from './VatSelector.svelte';

	dayjs.extend(relativeTime);

	type VatCountryCode = keyof typeof vatOptions;

	let {
		timeUnitPrice = 'perMonth',
		config,
		loading = false,
		displayStoragePrice: _displayStoragePrice,
		displayRamPrice: _displayRamPrice,
		clickable = true,
		buttons
	}: {
		timeUnitPrice?: 'perHour' | 'perMonth';
		config: ServerConfiguration;
		loading?: boolean;
		displayStoragePrice?: unknown;
		displayRamPrice?: unknown;
		clickable?: boolean;
		buttons?: import('svelte').Snippet;
	} = $props();

	let drawerHidden = $state(true);
	let selectedConfig = $state<ServerConfiguration | null>(null);

	// VAT
	const countryCode = $derived($settingsStore?.vatSelection?.countryCode ?? 'NET');
	const validCountryCode = $derived(
		countryCode && countryCode in vatOptions ? (countryCode as VatCountryCode) : 'NET'
	);
	const selectedOption = $derived(vatOptions[validCountryCode]);
	const priceWithVat = $derived((config.price ?? 0) * (1 + selectedOption.rate));
	const displayPrice = $derived(convertPrice(priceWithVat, 'EUR', $currentCurrency));
	const vatLabel = $derived(
		selectedOption.rate > 0 ? `incl. ${(selectedOption.rate * 100).toFixed(0)}% VAT` : 'net price'
	);

	// State
	const isAuction = $derived(!loading && config.server_type !== 'standard');
	const isBestDeal = $derived(
		!loading && isAuction && config.markup_percentage !== undefined && config.markup_percentage !== null && config.markup_percentage <= 0
	);
	const isFresh = $derived(
		!!config.last_seen && dayjs.unix(config.last_seen) > dayjs().subtract(80, 'minutes')
	);

	// Disks
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
	// Compact number formatter for tight cells.
	// >=10k → no decimal ("12k"); 1k-10k → one decimal ("1.6k"); <1k → as-is.
	function compact(n: number): string {
		if (n >= 10000) return Math.round(n / 1000) + 'k';
		if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
		return n.toString();
	}

	// Storage rows: prefer per-drive arrays; fall back to total *_size when arrays are empty
	function buildStorageRow(
		label: string,
		drives: number[] | undefined | null,
		totalGb: number | null | undefined
	) {
		if (drives && drives.length > 0) {
			const tb = totalTb(drives);
			return { label, text: formatDriveLine(drives), pricePerTb: tb > 0 ? displayPrice / tb : 0 };
		}
		if (totalGb && totalGb > 0) {
			const tb = totalGb / 1000;
			return { label, text: getFormattedDiskSize(totalGb), pricePerTb: tb > 0 ? displayPrice / tb : 0 };
		}
		return null;
	}

	const storageRows = $derived(
		[
			buildStorageRow('NVMe', config.nvme_drives, config.nvme_size),
			buildStorageRow('SATA', config.sata_drives, config.sata_size),
			buildStorageRow('HDD', config.hdd_drives, config.hdd_size)
		].filter(Boolean) as { label: string; text: string; pricePerTb: number }[]
	);

	// Icon for the storage tile based on dominant storage type
	const storageIcon = $derived(
		(config.nvme_drives?.length ?? 0) > 0 || (config.nvme_size ?? 0) > 0 ? faSdCard : faHardDrive
	);

	const ramPricePerGb = $derived(
		(config.ram_size ?? 0) > 0 ? displayPrice / (config.ram_size as number) : 0
	);

	const extras = $derived(
		[
			config.is_ecc && { label: 'ECC', icon: faShieldHalved, title: 'ECC memory' },
			config.with_inic && { label: 'iNIC', icon: faNetworkWired, title: 'Intel NIC (10G)' },
			config.with_gpu && { label: 'GPU', icon: faDisplay, title: 'GPU' },
			config.with_hwr && { label: 'HWR', icon: faLayerGroup, title: 'Hardware RAID' },
			config.with_rps && { label: 'RPS', icon: faPlug, title: 'Redundant power supply' }
		].filter(Boolean) as { label: string; icon: typeof faShieldHalved; title: string }[]
	);

	function handleKeydown(e: KeyboardEvent) {
		if (clickable && (e.key === 'Enter' || e.key === ' ')) {
			e.preventDefault();
			selectedConfig = config;
			drawerHidden = false;
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
	class={`group relative flex h-full w-full flex-col overflow-hidden rounded-xl bg-white text-left ring-1 transition-all duration-200 dark:bg-zinc-900
		${
			isBestDeal
				? 'shadow-[0_1px_3px_rgba(234,88,12,0.10)] ring-amber-300/70 hover:ring-amber-400 dark:ring-amber-500/40'
				: 'shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-zinc-200/80 hover:ring-zinc-300 dark:ring-zinc-700/60'
		}
		${clickable ? 'hover:cursor-pointer hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary-500/60 focus-visible:outline-none' : ''}`}
	data-testid="server-card"
	role={clickable ? 'button' : undefined}
	tabindex={clickable ? 0 : undefined}
	onclick={() => {
		if (clickable) {
			selectedConfig = config;
			drawerHidden = false;
		}
	}}
	onkeydown={handleKeydown}
>
	{#if isBestDeal}
		<div class="h-[3px] w-full bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400"></div>
	{/if}

	{#if loading}
		<!-- Skeleton: mirrors the real card structure for stable dimensions -->
		<div class="flex flex-1 animate-pulse flex-col p-4" aria-busy="true" aria-live="polite">
			<!-- Chrome strip -->
			<div class="mb-2.5 flex items-center justify-between">
				<div class="h-2.5 w-20 rounded bg-zinc-200/80 dark:bg-zinc-700/60"></div>
				<div class="h-3.5 w-14 rounded-full bg-zinc-200/80 dark:bg-zinc-700/60"></div>
			</div>
			<!-- Title (matches real card: cpu name + codename row) -->
			<div class="mb-3 min-h-[2.6rem]">
				<div class="h-3.5 w-3/5 rounded bg-zinc-200/80 dark:bg-zinc-700/60"></div>
				<div class="mt-1 h-2.5 w-1/3 rounded bg-zinc-200/50 dark:bg-zinc-700/40"></div>
			</div>
			<!-- 2x2 tile grid -->
			<div class="grid grid-cols-2 gap-1.5">
				{#each Array(4) as _, i (i)}
					<div class="rounded-lg bg-zinc-50 px-2.5 py-1.5 ring-1 ring-zinc-100 dark:bg-zinc-800/50 dark:ring-zinc-700/40">
						<div class="h-3 w-1/2 rounded bg-zinc-200/70 dark:bg-zinc-700/50"></div>
						<div class="mt-1 h-2 w-2/3 rounded bg-zinc-200/50 dark:bg-zinc-700/40"></div>
					</div>
				{/each}
			</div>
			<div class="grow"></div>
			<!-- Footer -->
			<div class="mt-3 flex items-end justify-between gap-3">
				<div class="flex gap-1">
					<div class="h-4 w-9 rounded-md bg-zinc-200/70 dark:bg-zinc-700/50"></div>
					<div class="h-4 w-9 rounded-md bg-zinc-200/70 dark:bg-zinc-700/50"></div>
				</div>
				<div class="flex flex-col items-end gap-1">
					<div class="h-5 w-20 rounded bg-zinc-200/80 dark:bg-zinc-700/60"></div>
					<div class="h-2 w-14 rounded bg-zinc-200/50 dark:bg-zinc-700/40"></div>
				</div>
			</div>
		</div>
	{:else}
		<div class="flex flex-1 flex-col p-4">
			<!-- Chrome strip -->
			<div class="mb-2.5 flex items-center justify-between text-[10px]">
				<span class="inline-flex items-center gap-1.5 text-zinc-400 dark:text-zinc-500">
					<span class="relative flex h-1.5 w-1.5">
						{#if isFresh}
							<span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60"></span>
						{/if}
						<span class={`relative inline-flex h-1.5 w-1.5 rounded-full ${isFresh ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}></span>
					</span>
					<span class="tabular-nums">
						{config.last_seen ? dayjs.unix(config.last_seen).fromNow() : 'never'}
					</span>
				</span>
				{#if isBestDeal}
					<span class="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
						<FontAwesomeIcon icon={faFire} class="h-2.5 w-2.5" />
						Best
					</span>
				{:else if isAuction}
					<span class="rounded-full px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase text-zinc-500 dark:text-zinc-400">
						Auction
					</span>
				{:else}
					<span class="rounded-full px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase text-zinc-500 dark:text-zinc-400">
						Standard
					</span>
				{/if}
			</div>

			<!-- Title (fixed 2-line height: cpu name + codename row) -->
			<div class="mb-3 min-h-[2.6rem]">
				<h3 class="truncate font-mono text-[14px] leading-tight font-semibold tracking-tight text-zinc-900 dark:text-zinc-50" title={config.cpu}>
					{config.cpu}
				</h3>
				<p class="mt-1 truncate text-[11px] text-zinc-400 dark:text-zinc-500" title={config.cpu_generation ?? ''}>
					{config.cpu_generation ?? '\u00a0'}
				</p>
			</div>

			<!-- Stat tiles: 2x2 grid -->
			<div class="grid grid-cols-2 gap-1.5">
				<!-- Cores / threads -->
				<div class="relative rounded-lg bg-zinc-50 px-2.5 py-1.5 ring-1 ring-zinc-100 dark:bg-zinc-800/50 dark:ring-zinc-700/40">
					<FontAwesomeIcon icon={faMicrochip} class="absolute top-1.5 right-1.5 h-3 w-3 text-zinc-300 dark:text-zinc-600" />
					<div class="overflow-hidden pr-5 font-mono text-sm leading-tight font-semibold tabular-nums whitespace-nowrap text-zinc-900 dark:text-zinc-100">
						{config.cpu_cores ?? '?'}<span class="text-zinc-300 dark:text-zinc-600">/</span>{config.cpu_threads ?? '?'}
					</div>
					<div class="text-[9px] tracking-wide text-zinc-400 dark:text-zinc-500">cores · threads</div>
				</div>

				<!-- RAM -->
				<div class="relative rounded-lg bg-zinc-50 px-2.5 py-1.5 ring-1 ring-zinc-100 dark:bg-zinc-800/50 dark:ring-zinc-700/40">
					<FontAwesomeIcon icon={faMemory} class="absolute top-1.5 right-1.5 h-3 w-3 text-zinc-300 dark:text-zinc-600" />
					<div class="overflow-hidden pr-5 font-mono text-sm leading-tight font-semibold tabular-nums whitespace-nowrap text-zinc-900 dark:text-zinc-100">
						{config.ram_size}<span class="ml-0.5 text-xs font-medium text-zinc-400 dark:text-zinc-500">GB</span>
					</div>
					<div class="text-[9px] tabular-nums text-zinc-400 dark:text-zinc-500">
						{ramPricePerGb > 0 ? `${ramPricePerGb.toFixed(2)} ${$currencySymbol}/GB` : 'memory'}
					</div>
				</div>

				<!-- Storage (icon implies type; truncate guards against long mixed-size strings) -->
				<div class="relative rounded-lg bg-zinc-50 px-2.5 py-1.5 ring-1 ring-zinc-100 dark:bg-zinc-800/50 dark:ring-zinc-700/40">
					<FontAwesomeIcon icon={storageIcon} class="absolute top-1.5 right-1.5 h-3 w-3 text-zinc-300 dark:text-zinc-600" />
					{#if storageRows.length === 0}
						<div class="truncate pr-5 font-mono text-xs leading-tight font-semibold text-zinc-400 dark:text-zinc-500">—</div>
						<div class="text-[9px] text-zinc-400 dark:text-zinc-500">no storage</div>
					{:else if storageRows.length === 1}
						<div class="truncate pr-5 font-mono text-xs leading-tight font-semibold tabular-nums text-zinc-900 dark:text-zinc-100" title={storageRows[0].text}>
							{storageRows[0].text}
						</div>
						<div class="truncate text-[9px] tabular-nums text-zinc-400 dark:text-zinc-500">
							{storageRows[0].label.toLowerCase()}{storageRows[0].pricePerTb > 0 ? ` · ${storageRows[0].pricePerTb.toFixed(0)} ${$currencySymbol}/TB` : ''}
						</div>
					{:else}
						<!-- Multi-type: stack each disk type, very compact -->
						{#each storageRows as row (row.label)}
							<div class="truncate pr-5 font-mono text-[10px] leading-tight font-semibold tabular-nums text-zinc-900 dark:text-zinc-100" title={`${row.text} ${row.label}`}>
								{row.text}<span class="ml-0.5 text-[9px] font-medium lowercase text-zinc-400 dark:text-zinc-500">{row.label}</span>
							</div>
						{/each}
					{/if}
				</div>

				<!-- Performance (GB6 single/multi) -->
				<div class="relative rounded-lg bg-zinc-50 px-2.5 py-1.5 ring-1 ring-zinc-100 dark:bg-zinc-800/50 dark:ring-zinc-700/40">
					<FontAwesomeIcon icon={faGaugeHigh} class="absolute top-1.5 right-1.5 h-3 w-3 text-zinc-300 dark:text-zinc-600" />
					<div class="overflow-hidden pr-5 font-mono text-sm leading-tight font-semibold tabular-nums whitespace-nowrap text-zinc-900 dark:text-zinc-100">
						{#if config.cpu_score || config.cpu_multicore_score}
							<span class={config.cpu_score ? '' : 'text-zinc-400 dark:text-zinc-500'}>{config.cpu_score ? compact(config.cpu_score) : '—'}</span><span class="text-zinc-300 dark:text-zinc-600">/</span><span class={config.cpu_multicore_score ? '' : 'text-zinc-400 dark:text-zinc-500'}>{config.cpu_multicore_score ? compact(config.cpu_multicore_score) : '—'}</span>
						{:else}
							<span class="text-zinc-400 dark:text-zinc-500">—</span>
						{/if}
					</div>
					<div class="text-[9px] tabular-nums text-zinc-400 dark:text-zinc-500">GB6 single · multi</div>
				</div>
			</div>

			<!-- Spacer -->
			<div class="grow"></div>

			<!-- Footer: extras (left) + price (right) on one line -->
			<div class="mt-3 flex items-end justify-between gap-3">
				<!-- Extras (left side, may be empty) -->
				<div class="flex min-w-0 flex-wrap items-center gap-1 self-start">
					{#each extras as ext (ext.label)}
						<span
							class="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
							title={ext.title}
						>
							<FontAwesomeIcon icon={ext.icon} class="h-2.5 w-2.5 text-zinc-400 dark:text-zinc-500" />
							{ext.label}
						</span>
					{/each}
				</div>

				<!-- Price (right) -->
				<div class="shrink-0 text-right">
					<div class="flex items-baseline justify-end gap-1 leading-none">
						<span class="text-xl font-semibold tracking-tight tabular-nums text-zinc-900 dark:text-zinc-50">
							{#if timeUnitPrice === 'perMonth'}
								{displayPrice.toFixed(2)}
							{:else}
								{(displayPrice / (30 * 24)).toFixed(4)}
							{/if}
						</span>
						<span class="text-sm font-medium text-zinc-500 dark:text-zinc-400">{$currencySymbol}</span>
						<span class="text-[11px] text-zinc-400 dark:text-zinc-500">/{timeUnitPrice === 'perMonth' ? 'mo' : 'hr'}</span>
					</div>
					<div class="mt-0.5 text-[10px] whitespace-nowrap text-zinc-500 dark:text-zinc-400">
						{vatLabel}
						{#if !isAuction && config.setup_price && config.setup_price > 0}
							<span class="mx-0.5 text-zinc-300 dark:text-zinc-600">·</span>
							<span class="tabular-nums">+{convertPrice(config.setup_price * (1 + selectedOption.rate), 'EUR', $currentCurrency).toFixed(0)} {$currencySymbol} setup</span>
						{/if}
					</div>
				</div>
				{#if buttons}{@render buttons()}{/if}
			</div>
		</div>
	{/if}
</div>
<ServerDetailDrawer bind:hidden={drawerHidden} config={selectedConfig} />
