<script lang="ts">
	import { goto } from '$app/navigation';
	import { withDbConnections } from '$lib/api/frontend/dbapi';
	import type { ServerConfiguration } from '$lib/api/frontend/filter';
	import { getPrices } from '$lib/api/frontend/filter';
	import { HETZNER_IPV4_COST_CENTS } from '$lib/constants';
	import { convertServerConfigurationToFilter, getHetznerLink } from '$lib/filter';
	import { filter } from '$lib/stores/filter';
	import { settingsStore } from '$lib/stores/settings';
	import { faExternalLinkAlt, faFilter, faShoppingCart } from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon as Fa } from '@fortawesome/svelte-fontawesome';
	import dayjs from 'dayjs';
	import {
		Button,
		CloseButton,
		Drawer,
		Indicator,
		Table,
		TableBody,
		TableBodyCell,
		TableBodyRow,
		Tooltip
	} from 'flowbite-svelte';
	import { sineIn } from 'svelte/easing';
	import { db } from '../../stores/db';
	import { getAuctionsForConfiguration, type AuctionResult } from '../api/frontend/auctions';
	import ServerFactSheet from './ServerFactSheet.svelte';
	import ServerPriceChart from './ServerPriceChart.svelte';
	import { vatOptions } from './VatSelector.svelte';
	import { convertPrice, formatCurrencyPrice } from '$lib/currency';
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
	let auctions = $state<AuctionResult[]>([]);
	let loadingAuctions = $state(false);

	// Fetch auctions when config changes or db is ready using $effect
	$effect(() => {
		const currentConfig = config; // Capture current value for the effect
		const currentDb = $db; // Capture current value for the effect

		// Ensure both config and $db are ready before fetching
		if (currentConfig && currentDb) {
			loadingAuctions = true;
			auctions = []; // Clear previous results
			let cancelled = false;

			(async () => {
				try {
					// Use withDbConnections to get a connection
					await withDbConnections(currentDb, async (conn) => {
						const result = await getAuctionsForConfiguration(
							conn,
							currentConfig,
							$filter?.recentlySeen ?? false
						);
						if (!cancelled) {
							auctions = result;
						}
					});
				} catch (error) {
					console.error('Error fetching auctions:', error);
					if (!cancelled) {
						auctions = []; // Ensure auctions is empty on error
					}
				} finally {
					if (!cancelled) {
						loadingAuctions = false;
					}
				}
			})();

			// Cleanup function for the effect
			return () => {
				cancelled = true;
			};
		} else {
			// Reset if config is null or db not ready
			auctions = [];
			loadingAuctions = false;
		}
	});

	function closeDrawer() {
		hidden = true;
	}

	type VatCountryCode = keyof typeof vatOptions;

	// Derived values using Svelte 5 runes
	// Currency and VAT related
	let selectedCurrency = $derived($settingsStore?.currencySelection?.code ?? 'EUR');
	let countryCode = $derived($settingsStore.vatSelection?.countryCode);
	let validCountryCode = $derived(
		countryCode && countryCode in vatOptions ? (countryCode as VatCountryCode) : 'NET'
	);
	// Explicitly cast validCountryCode to VatCountryCode for type safety when indexing vatOptions
	let selectedOption = $derived(
		config ? vatOptions[validCountryCode as VatCountryCode] : vatOptions['NET']
	);
	let priceInEur = $derived(config ? (config.price ?? 0) * (1 + selectedOption.rate) : 0);
	let displayPrice = $derived(convertPrice(priceInEur, 'EUR', selectedCurrency));
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

	let serverPrices = $state<any[]>([]);
	let loadingPrices = $state(true);

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
								goto('/analyze');
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
				<!-- Removed negative top/bottom margins (-mt-5, -mb-4) to prevent cropping -->
				<div class="-mx-3 h-20">
					<ServerPriceChart
						data={serverPrices}
						loading={loadingPrices}
						toolbarShow={false}
						legendShow={false}
						timeUnitPrice={selectedTimeUnit}
					/>
				</div>
				<span class="text-lg font-bold text-gray-900 dark:text-white">
					{selectedTimeUnit === 'perMonth' ? formatCurrencyPrice(displayPrice, selectedCurrency, 'mo') : formatCurrencyPrice(displayPrice / (30 * 24), selectedCurrency, 'hr')}
				</span>
				<span class="ml-1 text-sm text-gray-600 dark:text-gray-400">{vatSuffix}</span>
				<span class="ml-1 text-xs text-gray-400 dark:text-gray-500">
					{selectedTimeUnit === 'perMonth' ? 'monthly' : 'hourly'}
				</span>
				<!-- Markup Percentage Display -->
				{#if config.markup_percentage !== null}
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
		</div>

		<!-- Server Hardware Details -->
		<ServerFactSheet {config} {displayPrice} showPricePerUnit={true} class="mb-3" />
		<div class="mb-1 flex items-center justify-between">
			<h6 class="text-lg font-medium text-gray-900 dark:text-white">Auctions</h6>
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
		<Table hoverable={true} striped={true}>
			<TableBody class="divide-y">
				{#if loadingAuctions}
					<TableBodyRow>
						<TableBodyCell colspan={3} class="py-4 text-center">
							<p class="text-gray-700 dark:text-gray-400">Loading auctions...</p>
						</TableBodyCell>
					</TableBodyRow>
				{:else if auctions.length > 0}
					{#each auctions.slice(0, 5) as auction (auction.id)}
						<TableBodyRow>
							<TableBodyCell class="px-1 py-4">
								<div>#{auction.id}</div>
								<div class="mt-1 text-xs text-gray-400 dark:text-gray-500">
									<span class="inline-flex items-center">
										{#if dayjs.unix(auction.lastSeen ?? 0) > dayjs().subtract(80, 'minutes')}
											<Indicator color="green" class="mr-1.5 animate-pulse" size="xs" />
										{:else}
											<Indicator color="red" class="mr-1.5" size="xs" />
										{/if}
										seen {auction.lastSeen ? dayjs.unix(auction.lastSeen).fromNow() : 'unknown'}
									</span>
								</div>
							</TableBodyCell>
							<TableBodyCell class="px-2 py-4 text-right"
								>{(
									(auction.lastPrice + HETZNER_IPV4_COST_CENTS / 100) *
									(1 + selectedOption.rate)
								).toFixed(2)} €</TableBodyCell
							>
							<TableBodyCell class="px-2 py-4 text-right">
								<form
									action="https://robot.hetzner.com/order/marketConfirm"
									method="POST"
									target="_blank"
								>
									<input type="hidden" name="id" value={auction.id} />
									<input type="hidden" name="server_id" value={auction.id} />
									<input type="hidden" name="culture" value="en_GB" />
									<input type="hidden" name="ip[1266]" value="1" />
									<input type="hidden" name="country" value={validCountryCode.toLowerCase()} />
									<input type="hidden" name="currency" value={selectedCurrency} />
									<Button type="submit" size="md" aria-label="Confirm Order" class="px-4">
										<Fa icon={faShoppingCart} />
									</Button>
								</form>
							</TableBodyCell>
						</TableBodyRow>
					{/each}
				{:else}
					<TableBodyRow>
						<TableBodyCell colspan={3} class="py-4 text-center">
							<p class="text-gray-700 dark:text-gray-400">No matching auctions found.</p>
						</TableBodyCell>
					</TableBodyRow>
				{/if}
			</TableBody>
		</Table>
		{#if auctions.length > 5}
			<p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
				Showing the 5 most recently seen auctions. More may be available.
			</p>
		{/if}

		<hr class="my-4 border-gray-200 dark:border-gray-600" />
		<div class="space-y-2 text-xs leading-relaxed text-gray-400 dark:text-gray-500">
			<p>
				Clicking the <Fa icon={faShoppingCart} class="mx-1 inline" /> button redirects you to Hetzner
				to confirm the order. Clicking the <Fa icon={faExternalLinkAlt} class="mx-1 inline" /> button
				opens a preconfigured Hetzner search.
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
	{:else}
		<p class="text-gray-500 dark:text-gray-400">No server selected.</p>
	{/if}
</Drawer>
