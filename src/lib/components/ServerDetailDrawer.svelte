<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { withDbConnections } from '$lib/api/frontend/dbapi';
	import type { ServerConfiguration, ServerPriceStat } from '$lib/api/frontend/filter';
	import { getPrices } from '$lib/api/frontend/filter';
	import { convertServerConfigurationToFilter, getHetznerLink } from '$lib/filter';
	import { filter } from '$lib/stores/filter';
	import { settingsStore, currencySymbol, currentCurrency } from '$lib/stores/settings';
	import { convertPrice } from '$lib/currency';
	import {
		faArrowDown,
		faChartLine,
		faExternalLinkAlt,
		faFilter,
		faGavel,
		faShoppingCart,
		faStore
	} from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon as Fa } from '@fortawesome/svelte-fontawesome';
	import dayjs from 'dayjs';
	import { Button, CloseButton, Drawer, Indicator, Tooltip } from 'flowbite-svelte';
	import { sineIn } from 'svelte/easing';
	import { db } from '../../stores/db';
	import ServerFactSheet from './ServerFactSheet.svelte';
	import ServerPriceChart from './ServerPriceChart.svelte';
	import { vatOptions } from './VatSelector.svelte';
	import type { LiveAuctionResult } from '../../routes/api/auctions/+server';
	// Runes ($state, $derived, etc.) are compiler features and don't need explicit imports.

	// Props using Svelte 5 runes
	interface _$Props {
		config?: ServerConfiguration | null;
		hidden?: boolean;
	}
	// Define props using $props. Default values are assigned directly.
	// Type inference usually works, so <_$Props> is often optional.
	let { config = null, hidden = $bindable(true) } = $props();

	let transitionParamsRight = {
		x: 320,
		duration: 200,
		easing: sineIn
	};

	// State using Svelte 5 runes
	let auctions = $state<LiveAuctionResult[]>([]);
	let loadingAuctions = $state(false);

	// Fetch auctions from live D1 API when config changes (only for auction servers)
	$effect(() => {
		const currentConfig = config;
		const currentFilter = $filter;

		// Skip fetching for standard servers - they don't have auction listings
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

	// Derived values using Svelte 5 runes
	// Add optional chaining ?. to safely access countryCode
	let countryCode = $derived($settingsStore.vatSelection?.countryCode);
	let validCountryCode = $derived(
		countryCode && countryCode in vatOptions ? (countryCode as VatCountryCode) : 'NET'
	);
	// Explicitly cast validCountryCode to VatCountryCode for type safety when indexing vatOptions
	let selectedOption = $derived(
		config ? vatOptions[validCountryCode as VatCountryCode] : vatOptions['NET']
	);
	let priceWithVat = $derived(config ? (config.price ?? 0) * (1 + selectedOption.rate) : 0);
	let displayPrice = $derived(convertPrice(priceWithVat, 'EUR', $currentCurrency));
	let vatSuffix = $derived(
		selectedOption.rate > 0 ? `(${(selectedOption.rate * 100).toFixed(0)}% VAT)` : '(net)'
	);
	let selectedTimeUnit = $derived((
		$settingsStore.timeUnitPrice ?? 'perMonth'
	) as 'perMonth' | 'perHour');

	// Calculate color hue for markup percentage (green=0% to red=100%)
	// Hue range: 120 (green) down to 0 (red)
	let markupColorHue = $derived(
		config && config.markup_percentage !== null
			? Math.max(0, 120 - (config.markup_percentage / 100) * 120)
			: 120 // Default to green if no markup
	);

	let serverPrices = $state<ServerPriceStat[]>([]);
	let loadingPrices = $state(true);

	// Derived stats from serverPrices
	let lowestPriceRecord = $derived(
		serverPrices.length > 0
			? serverPrices.reduce((min, p) => (p.min_price < min.min_price ? p : min), serverPrices[0])
			: null
	);
	let lowestPrice = $derived(lowestPriceRecord?.min_price ?? null);
	let lowestPriceDate = $derived(lowestPriceRecord?.seen ? dayjs.unix(lowestPriceRecord.seen) : null);
	let averageSupply = $derived(
		serverPrices.length > 0
			? Math.round(serverPrices.reduce((sum, p) => sum + p.count, 0) / serverPrices.length)
			: null
	);
	let currentSupply = $derived(
		serverPrices.length > 0 ? serverPrices[serverPrices.length - 1]?.count ?? null : null
	);
	let supplyTrend = $derived(
		averageSupply !== null && currentSupply !== null && averageSupply > 0
			? Math.round(((currentSupply - averageSupply) / averageSupply) * 100)
			: null
	);

	// Fetch prices using $effect
	$effect(() => {
		const currentConfig = config; // Capture current value
		const currentDb = $db; // Capture current value

		if (currentConfig && currentDb) {
			loadingPrices = true;
			let cancelled = false;

			(async () => {
				try {
					await withDbConnections(currentDb, async (conn) => {
						const prices = await getPrices(conn, convertServerConfigurationToFilter(currentConfig));
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

			// Cleanup function
			return () => {
				cancelled = true;
			};
		} else {
			serverPrices = [];
			loadingPrices = false;
		}
	});
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
	class="border-l border-gray-200 dark:border-gray-700"
>
	<div class="mb-4 flex items-center">
		<h5 class="inline-flex items-center text-base font-semibold text-gray-500 dark:text-gray-400">
			Server Details
		</h5>
		<CloseButton onclick={closeDrawer} class="ms-auto" />
	</div>

	{#if config}
		<div class="mb-6">
			<div class="mb-2 flex items-center justify-between">
				<h5 class="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
					{config.cpu}
				</h5>
				<Button
					size="xs"
					color="alternative"
					onclick={() => {
						const currentConfig = config; // Use captured value
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
				>
					<Fa icon={faFilter} />
				</Button>
				<Tooltip placement="bottom" class="z-50">Apply configuration to filter</Tooltip>
			</div>
			<!-- Price with VAT -->
			<div class="mb-3 max-w-full overflow-hidden">
				<!-- Price chart - only show for auction servers -->
				{#if config.server_type !== 'standard'}
					<div class="-mx-3 h-20">
						<ServerPriceChart
							data={serverPrices}
							loading={loadingPrices}
							toolbarShow={false}
							legendShow={false}
							timeUnitPrice={selectedTimeUnit}
						/>
					</div>
				{/if}
				<span class="text-lg font-bold text-gray-900 dark:text-white">
					{displayPrice.toFixed(2)} {$currencySymbol}
				</span>
				<span class="ml-1 text-sm text-gray-600 dark:text-gray-400">{vatSuffix}</span>
				<span class="ml-1 text-xs text-gray-400 dark:text-gray-500">
					{selectedTimeUnit === 'perMonth' ? 'monthly' : 'hourly'}
				</span>
				<!-- Setup fee for standard servers -->
				{#if config.server_type === 'standard' && config.setup_price && config.setup_price > 0}
					<div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
						+ {convertPrice(config.setup_price * (1 + selectedOption.rate), 'EUR', $currentCurrency).toFixed(0)} {$currencySymbol} setup fee
					</div>
				{/if}
				<!-- Markup Percentage Display - only for auctions -->
				{#if config.server_type !== 'standard' && config.markup_percentage !== null}
					<div class="mt-1 text-xs text-gray-400 dark:text-gray-500">
						{#if config.markup_percentage > 0}
							<span style={`color: hsl(${markupColorHue}, 100%, 40%)`}>
								{(config.markup_percentage ?? 0).toFixed(0)}%
							</span> higher than best
						{:else}
							best price
						{/if}
					</div>
				{/if}
			</div>

			<!-- Auction Stats - only for auctions -->
			{#if config.server_type !== 'standard'}
				{#if !loadingPrices && serverPrices.length > 0}
					<div
						class="mb-3 grid grid-cols-2 gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800"
					>
						<!-- Lowest Price -->
						<div class="flex items-start gap-2">
							<Fa icon={faArrowDown} class="mt-0.5 text-green-500" size="sm" />
							<div>
								<div class="text-xs text-gray-500 dark:text-gray-400">Lowest Price</div>
								<div class="font-semibold text-gray-900 dark:text-white">
									{lowestPrice !== null ? `${convertPrice(lowestPrice * (1 + selectedOption.rate), 'EUR', $currentCurrency).toFixed(2)} ${$currencySymbol}` : '—'}
								</div>
								{#if lowestPriceDate}
									<div class="text-xs text-gray-400 dark:text-gray-500">
										{lowestPriceDate.format('MMM D, YYYY')}
									</div>
								{/if}
							</div>
						</div>

						<!-- Average Supply -->
						<div class="flex items-start gap-2">
							<Fa icon={faChartLine} class="mt-0.5 text-blue-500" size="sm" />
							<div>
								<div class="text-xs text-gray-500 dark:text-gray-400">Avg. Supply</div>
								<div class="font-semibold text-gray-900 dark:text-white">
									{averageSupply !== null ? `${averageSupply}/day` : '—'}
								</div>
								{#if supplyTrend !== null}
									<div class="text-xs">
										{#if supplyTrend > 0}
											<span class="text-green-600 dark:text-green-400">+{supplyTrend}%</span>
										{:else if supplyTrend < 0}
											<span class="text-red-600 dark:text-red-400">{supplyTrend}%</span>
										{:else}
											<span class="text-gray-400 dark:text-gray-500">stable</span>
										{/if}
										<span class="text-gray-400 dark:text-gray-500">now</span>
									</div>
								{/if}
							</div>
						</div>
					</div>
				{:else if loadingPrices}
					<div
						class="mb-3 animate-pulse rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800"
					>
						<div class="h-12"></div>
					</div>
				{/if}
			{/if}
		</div>

		<!-- Server Hardware Details -->
		<ServerFactSheet {config} {displayPrice} showPricePerUnit={true} layout="horizontal" class="mb-3" />

		{#if config?.server_type === 'standard'}
			<!-- Standard server - direct order link -->
			<div class="mb-1 flex items-center justify-between">
				<h6 class="flex items-center gap-2 text-lg font-medium text-gray-900 dark:text-white">
					<Fa icon={faStore} />
					Standard Server
				</h6>
			</div>
		{:else}
			<!-- Auction server - show available auctions -->
			<div class="mb-1 flex items-center justify-between">
				<h6 class="flex items-center gap-2 text-lg font-medium text-gray-900 dark:text-white">
					<Fa icon={faGavel} />
					Auctions
				</h6>
				{#if config}
					<Button
						href={getHetznerLink(config)}
						target="_blank"
						rel="noopener noreferrer"
						size="xs"
						color="alternative"
					>
						<Fa icon={faExternalLinkAlt} />
					</Button>
					<Tooltip placement="bottom" class="z-50">Search on Hetzner with this configuration</Tooltip>
				{/if}
			</div>
		{/if}

		{#if config?.server_type === 'standard'}
			<!-- Standard server details -->
			<div class="mb-3 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-700 dark:bg-gray-800">
				{#if config.datacenter}
					<div class="flex justify-between">
						<span class="text-gray-500 dark:text-gray-400">Datacenter</span>
						<span class="font-medium text-gray-900 dark:text-white">{config.datacenter}</span>
					</div>
				{/if}
				{#if config.cpu_cores || config.cpu_threads}
					<div class="flex justify-between">
						<span class="text-gray-500 dark:text-gray-400">CPU Cores/Threads</span>
						<span class="font-medium text-gray-900 dark:text-white">
							{config.cpu_cores ?? '?'} / {config.cpu_threads ?? '?'}
						</span>
					</div>
				{/if}
				{#if config.cpu_generation}
					<div class="flex justify-between">
						<span class="text-gray-500 dark:text-gray-400">CPU Generation</span>
						<span class="font-medium text-gray-900 dark:text-white">{config.cpu_generation}</span>
					</div>
				{/if}
				{#if config.setup_price && config.setup_price > 0}
					<div class="flex justify-between">
						<span class="text-gray-500 dark:text-gray-400">Setup Fee</span>
						<span class="font-medium text-gray-900 dark:text-white">
							{convertPrice(config.setup_price * (1 + selectedOption.rate), 'EUR', $currentCurrency).toFixed(2)} {$currencySymbol}
						</span>
					</div>
				{/if}
			</div>

			<!-- Standard server - show order button -->
			<div class="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
				<p class="mb-3 text-sm text-gray-700 dark:text-gray-300">
					This is a standard dedicated server from Hetzner's regular lineup with fixed pricing.
				</p>
				<Button
					href={`https://www.hetzner.com/dedicated-rootserver?utm_source=server-radar&utm_medium=referral&utm_campaign=standard-server#search=${config.information?.[0] ?? ''}`}
					target="_blank"
					rel="noopener noreferrer"
					color="blue"
					class="w-full"
				>
					<Fa icon={faShoppingCart} class="mr-2" />
					Order from Hetzner
				</Button>
			</div>
			<hr class="my-4 border-gray-200 dark:border-gray-600" />
			<div class="space-y-2 text-xs leading-relaxed text-gray-400 dark:text-gray-500">
				<p>
					Standard servers have fixed pricing and are always available for order directly from Hetzner.
				</p>
				<p>
					Prices shown include VAT based on your selection. Hetzner's final price may vary based on configuration options.
				</p>
			</div>
		{:else}
			<!-- Auction server - show available auctions -->
			<div class="space-y-2">
				{#if loadingAuctions}
					<div class="py-4 text-center">
						<p class="text-gray-700 dark:text-gray-400">Loading auctions...</p>
					</div>
				{:else if auctions.length > 0}
					{#each auctions.slice(0, 5) as auction (auction.id)}
						<div class="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
							<div class="flex items-start justify-between gap-2">
								<div class="min-w-0 flex-1">
									<div class="flex items-center gap-2">
										<span class="font-mono text-sm font-medium text-gray-900 dark:text-white">#{auction.id}</span>
										<span class="inline-flex items-center">
											{#if dayjs.unix(auction.lastSeen ?? 0) > dayjs().subtract(80, 'minutes')}
												<Indicator color="green" class="animate-pulse" size="xs" />
											{:else}
												<Indicator color="red" size="xs" />
											{/if}
										</span>
									</div>
									<div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
										{auction.datacenter}
									</div>
									<div class="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
										seen {auction.lastSeen ? dayjs.unix(auction.lastSeen).fromNow() : 'unknown'}
									</div>
								</div>
								<div class="flex items-center gap-2">
									<div class="text-right">
										<div class="font-medium text-gray-900 dark:text-white">
											{convertPrice(
												auction.lastPrice * (1 + selectedOption.rate),
												'EUR',
												$currentCurrency
											).toFixed(2)} {$currencySymbol}
										</div>
										<div class="text-xs text-gray-500 dark:text-gray-400">
											{vatSuffix}
										</div>
									</div>
									<Button
										href={`https://www.hetzner.com/sb/?utm_source=server-radar&utm_medium=referral&utm_campaign=auction#search=${auction.id}`}
										target="_blank"
										rel="noopener noreferrer"
										size="sm"
										aria-label="View on Hetzner"
									>
										<Fa icon={faShoppingCart} />
									</Button>
								</div>
							</div>
						</div>
					{/each}
				{:else}
					<div class="py-4 text-center">
						<p class="text-gray-700 dark:text-gray-400">No matching auctions found.</p>
					</div>
				{/if}
			</div>
			{#if auctions.length > 5}
				<p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
					Showing the 5 most recently seen auctions. More may be available.
				</p>
			{/if}

			<hr class="my-4 border-gray-200 dark:border-gray-600" />
			<div class="space-y-2 text-xs leading-relaxed text-gray-400 dark:text-gray-500">
				<p>
					Clicking the <Fa icon={faShoppingCart} class="mx-1 inline" /> button opens the auction
					on Hetzner's server auction page.
				</p>
				<p>
					Please note: Hetzner search results depend on availability and may differ. Ensure server
					specs meet your needs. Prices shown here include VAT based on your selection, but Hetzner's
					final price may vary.
				</p>
				<p>
					This service is provided "as is" without warranty. The author assumes no responsibility for
					issues or discrepancies on the Hetzner platform.
				</p>
			</div>
		{/if}
	{:else}
		<p class="text-gray-500 dark:text-gray-400">No server selected.</p>
	{/if}
</Drawer>
