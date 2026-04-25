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
		clickable = true
	}: {
		timeUnitPrice?: 'perHour' | 'perMonth';
		config: ServerConfiguration;
		clickable?: boolean;
	} = $props();

	let drawerHidden = $state(true);
	let selectedConfig = $state<ServerConfiguration | null>(null);

	const countryCode = $derived($settingsStore?.vatSelection?.countryCode ?? 'NET');
	const validCountryCode = $derived(
		countryCode && countryCode in vatOptions ? (countryCode as VatCountryCode) : 'NET'
	);
	const selectedOption = $derived(vatOptions[validCountryCode]);
	const priceWithVat = $derived((config.price ?? 0) * (1 + selectedOption.rate));
	const displayPrice = $derived(convertPrice(priceWithVat, 'EUR', $currentCurrency));

	const isAuction = $derived(config.server_type !== 'standard');
	const isBestDeal = $derived(
		isAuction &&
			config.markup_percentage !== undefined &&
			config.markup_percentage !== null &&
			config.markup_percentage <= 0
	);
	const isFresh = $derived(
		!!config.last_seen && dayjs.unix(config.last_seen) > dayjs().subtract(80, 'minutes')
	);

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
	function buildStorageRow(
		label: string,
		drives: number[] | undefined | null,
		totalGb: number | null | undefined
	) {
		if (drives && drives.length > 0) {
			return { label, text: formatDriveLine(drives) };
		}
		if (totalGb && totalGb > 0) {
			return { label, text: getFormattedDiskSize(totalGb) };
		}
		return null;
	}

	const storageRows = $derived(
		[
			buildStorageRow('NVMe', config.nvme_drives, config.nvme_size),
			buildStorageRow('SATA', config.sata_drives, config.sata_size),
			buildStorageRow('HDD', config.hdd_drives, config.hdd_size)
		].filter(Boolean) as { label: string; text: string }[]
	);
	const storageIcon = $derived(
		(config.nvme_drives?.length ?? 0) > 0 || (config.nvme_size ?? 0) > 0 ? faSdCard : faHardDrive
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

	function compact(n: number): string {
		if (n >= 10000) return Math.round(n / 1000) + 'k';
		if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
		return n.toString();
	}

	function handleClick() {
		if (clickable) {
			selectedConfig = config;
			drawerHidden = false;
		}
	}
	function handleKeydown(e: KeyboardEvent) {
		if (clickable && (e.key === 'Enter' || e.key === ' ')) {
			e.preventDefault();
			handleClick();
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
	class={`group relative col-span-8 grid grid-cols-subgrid items-center overflow-hidden rounded-lg bg-white px-4 py-2 text-left ring-1 transition-all duration-150 dark:bg-zinc-900
		${
			isBestDeal
				? 'shadow-[0_1px_2px_rgba(234,88,12,0.06)] ring-amber-300/70 hover:ring-amber-400 dark:ring-amber-500/40'
				: 'ring-zinc-200/80 hover:ring-zinc-300 dark:ring-zinc-700/60'
		}
		${clickable ? 'hover:cursor-pointer hover:bg-zinc-50/80 focus-visible:ring-2 focus-visible:ring-primary-500/60 focus-visible:outline-none dark:hover:bg-zinc-800/40' : ''}`}
	data-testid="server-row"
	role={clickable ? 'button' : undefined}
	tabindex={clickable ? 0 : undefined}
	onclick={handleClick}
	onkeydown={handleKeydown}
>
	{#if isBestDeal}
		<span
			class="absolute top-0 bottom-0 left-0 w-[3px] bg-gradient-to-b from-amber-400 via-orange-500 to-amber-400"
		></span>
	{/if}

	<!-- 1: Title (CPU + codename + freshness inline); CPU never truncated -->
	<div class="min-w-0">
		<div class="flex items-center gap-1.5">
			<span
				class="font-mono text-[13px] leading-tight font-semibold tracking-tight whitespace-nowrap text-zinc-900 dark:text-zinc-50"
				title={config.cpu}
			>
				{config.cpu}
			</span>
			{#if isBestDeal}
				<span
					class="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0 text-[9px] font-semibold tracking-wide uppercase text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
				>
					<FontAwesomeIcon icon={faFire} class="h-2 w-2" />
					Best
				</span>
			{/if}
		</div>
		<div class="mt-0.5 flex items-center gap-1.5 truncate text-[10px] leading-tight text-zinc-400 dark:text-zinc-500">
			<span>{config.cpu_generation ?? '—'}</span>
			<span class="text-zinc-300 dark:text-zinc-600">·</span>
			<span class="relative inline-flex h-1.5 w-1.5 shrink-0">
				{#if isFresh}
					<span
						class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60"
					></span>
				{/if}
				<span
					class={`relative inline-flex h-1.5 w-1.5 rounded-full ${isFresh ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}
				></span>
			</span>
			<span>seen {config.last_seen ? dayjs.unix(config.last_seen).fromNow() : 'never'}</span>
		</div>
	</div>

	<!-- 3: Cores -->
	<div class="text-right">
		<div
			class="flex items-center justify-end gap-1 font-mono text-[13px] leading-tight font-semibold tabular-nums whitespace-nowrap text-zinc-900 dark:text-zinc-100"
		>
			<FontAwesomeIcon icon={faMicrochip} class="h-2.5 w-2.5 text-zinc-300 dark:text-zinc-600" />
			{config.cpu_cores ?? '?'}<span class="text-zinc-300 dark:text-zinc-600">/</span>{config.cpu_threads ?? '?'}
		</div>
		<div class="mt-0.5 text-[10px] leading-tight text-zinc-400 dark:text-zinc-500">cores</div>
	</div>

	<!-- 4: RAM -->
	<div class="text-right">
		<div
			class="flex items-center justify-end gap-1 font-mono text-[13px] leading-tight font-semibold tabular-nums whitespace-nowrap text-zinc-900 dark:text-zinc-100"
		>
			<FontAwesomeIcon icon={faMemory} class="h-2.5 w-2.5 text-zinc-300 dark:text-zinc-600" />
			{config.ram_size}<span class="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">GB</span>
		</div>
		<div class="mt-0.5 text-[10px] leading-tight text-zinc-400 dark:text-zinc-500">memory</div>
	</div>

	<!-- 5: Storage (truncates if long) -->
	<div class="min-w-0 text-right">
		<div
			class="flex items-center justify-end gap-1 truncate font-mono text-[13px] leading-tight font-semibold tabular-nums text-zinc-900 dark:text-zinc-100"
		>
			<FontAwesomeIcon icon={storageIcon} class="h-2.5 w-2.5 shrink-0 text-zinc-300 dark:text-zinc-600" />
			<span class="truncate" title={storageRows.map((r) => `${r.text} ${r.label}`).join(' + ')}>
				{#if storageRows.length === 0}—{:else}{storageRows[0].text}{#if storageRows.length > 1}<span
							class="text-zinc-400 dark:text-zinc-500"> +</span
						>{/if}{/if}
			</span>
		</div>
		<div class="mt-0.5 truncate text-[10px] leading-tight text-zinc-400 dark:text-zinc-500">
			{storageRows[0]?.label.toLowerCase() ?? 'storage'}
		</div>
	</div>

	<!-- 6: GB6 -->
	<div class="text-right">
		<div
			class="flex items-center justify-end gap-1 font-mono text-[13px] leading-tight font-semibold tabular-nums whitespace-nowrap text-zinc-900 dark:text-zinc-100"
		>
			<FontAwesomeIcon icon={faGaugeHigh} class="h-2.5 w-2.5 text-zinc-300 dark:text-zinc-600" />
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
		<div class="mt-0.5 text-[10px] leading-tight text-zinc-400 dark:text-zinc-500">gb6 sc/mc</div>
	</div>

	<!-- 7: Extras (chips on the value line, label below for height match) -->
	<div>
		<div class="flex h-[16px] items-center gap-1">
			{#each extras as ext (ext.label)}
				<span
					class="inline-flex items-center gap-0.5 rounded bg-zinc-100 px-1 py-0 font-mono text-[10px] leading-none font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
					title={ext.title}
				>
					<FontAwesomeIcon icon={ext.icon} class="h-2 w-2 text-zinc-400 dark:text-zinc-500" />
					{ext.label}
				</span>
			{/each}
		</div>
		<div class="mt-0.5 text-[10px] leading-tight text-zinc-400 dark:text-zinc-500">extras</div>
	</div>

	<!-- 8: Flex spacer (pushes price to the right) -->
	<div></div>

	<!-- 9: Price -->
	<div class="text-right">
		<div class="flex items-baseline justify-end gap-0.5 leading-tight">
			<span
				class="font-mono text-[13px] font-semibold tabular-nums text-zinc-900 dark:text-zinc-50"
			>
				{#if timeUnitPrice === 'perMonth'}
					{displayPrice.toFixed(2)}
				{:else}
					{(displayPrice / (30 * 24)).toFixed(4)}
				{/if}
			</span>
			<span class="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{$currencySymbol}</span>
		</div>
		<div class="mt-0.5 text-[10px] leading-tight text-zinc-400 dark:text-zinc-500">
			/{timeUnitPrice === 'perMonth' ? 'mo' : 'hr'}{selectedOption.rate > 0
				? ` · incl. ${(selectedOption.rate * 100).toFixed(0)}%`
				: ''}
		</div>
	</div>
</div>
<ServerDetailDrawer bind:hidden={drawerHidden} config={selectedConfig} />
