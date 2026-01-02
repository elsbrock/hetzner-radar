<script lang="ts">
	import { type ServerConfiguration } from '$lib/api/frontend/filter';
	import { settingsStore, currencySymbol, currentCurrency } from '$lib/stores/settings';
	import { convertPrice } from '$lib/currency';
	import dayjs from 'dayjs';
	import relativeTime from 'dayjs/plugin/relativeTime';
	import { Card, Indicator, Spinner, Tooltip } from 'flowbite-svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faFire, faGavel, faStore } from '@fortawesome/free-solid-svg-icons';
	import ServerDetailDrawer from './ServerDetailDrawer.svelte';
	import ServerFactSheet from './ServerFactSheet.svelte';
	import { vatOptions } from './VatSelector.svelte';

	dayjs.extend(relativeTime);

	// Define the type for VAT option keys based on the imported value
	type VatCountryCode = keyof typeof vatOptions;

	let {
		timeUnitPrice = 'perMonth',
		config,
		loading = false,
		displayStoragePrice: _displayStoragePrice, // Included but not yet used in rendering logic
		displayRamPrice: _displayRamPrice, // Included but not yet used in rendering logic
		clickable = true, // Default to clickable
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

	// VAT related derived state
	const countryCode = $derived($settingsStore?.vatSelection?.countryCode ?? 'NET'); // Default to 'NET' if undefined
	const validCountryCode = $derived(
		countryCode && countryCode in vatOptions ? (countryCode as VatCountryCode) : 'NET'
	);
	const selectedOption = $derived(vatOptions[validCountryCode]);
	const priceWithVat = $derived((config.price ?? 0) * (1 + selectedOption.rate));
	const displayPrice = $derived(convertPrice(priceWithVat, 'EUR', $currentCurrency));
	const vatSuffix = $derived(
		selectedOption.rate > 0 ? `(${(selectedOption.rate * 100).toFixed(0)}% VAT)` : '(net)'
	);

	// Calculate color hue based on markup percentage (0% = green, 100% = red)
	// Hue range: 120 (green) down to 0 (red)
	const markupColorHue = $derived(() => {
		const percentage = config.markup_percentage ?? 0;
		// Clamp percentage between 0 and 100 for hue calculation
		const clampedPercentage = Math.max(0, Math.min(100, percentage));
		// Linear interpolation: hue = 120 * (1 - (clampedPercentage / 100))
		return 120 * (1 - clampedPercentage / 100);
	});

	const baseClasses =
		'relative group text-left flex flex-col min-h-[210px] sm:min-h-[210px] md:min-h-[210px] lg:min-h-[210px] bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300';
	const clickableClasses = 'hover:cursor-pointer';
</script>

<Card
	class={`${baseClasses} ${clickable ? clickableClasses : ''} ${(config.markup_percentage ?? 0) <= 0 ? 'border-l-4 border-l-green-700!' : ''}`}
	data-testid="server-card"
	style="padding: 15px"
	onclick={() => {
		if (clickable) {
			selectedConfig = config;
			drawerHidden = false;
		}
	}}
>
	{#if loading}
		<!-- Loading Spinner -->
		<div class="flex h-full items-center justify-center">
			<Spinner />
		</div>
	{:else}
		<!-- DEAL indicator -->
		{#if (config.markup_percentage ?? 0) <= 0}
			<div class="absolute top-5 right-3 text-orange-500">
				<FontAwesomeIcon icon={faFire} size="lg" />
			</div>
			<Tooltip placement="left">Best price</Tooltip>
		{/if}

		<!-- Header -->
		<div>
			<h5 class="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">
				{config.cpu}
			</h5>
			<div class="mb-3 flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
				<span class="inline-flex items-center">
					{#if dayjs.unix(config.last_seen ?? 0) > dayjs().subtract(80, 'minutes')}
						<Indicator color="green" class="mr-2 animate-pulse" size="xs" />
					{:else}
						<Indicator color="red" class="mr-2" size="xs" />
					{/if}
					seen {config.last_seen ? dayjs.unix(config.last_seen).fromNow() : 'unknown'}
				</span>
				{#if config.server_type === 'standard'}
					<span class="inline-flex items-center gap-1 rounded bg-blue-100 px-1.5 py-0.5 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
						<FontAwesomeIcon icon={faStore} class="h-2.5 w-2.5" />
						Standard
					</span>
				{:else}
					<span class="inline-flex items-center gap-1 rounded bg-orange-100 px-1.5 py-0.5 text-orange-700 dark:bg-orange-900 dark:text-orange-300">
						<FontAwesomeIcon icon={faGavel} class="h-2.5 w-2.5" />
						Auction
					</span>
				{/if}
			</div>
		</div>

		<!-- Server Fact Sheet -->
		<ServerFactSheet {config} {displayPrice} showPricePerUnit={true} showBadges={true} />

		<!-- Spacer - absorbs variable height so footer stays at bottom -->
		<div class="grow"></div>

		<!-- Footer -->
		<div class="mt-4 flex items-center justify-between">
			<div>
				<div>
					<span class="text-xl font-bold text-gray-900 dark:text-white">
						{#if timeUnitPrice === 'perMonth'}
							{displayPrice.toFixed(2)} {$currencySymbol}
						{:else if timeUnitPrice === 'perHour'}
							{(displayPrice / (30 * 24)).toFixed(4)} {$currencySymbol}
						{/if}
					</span>
					<span class="ml-1 text-xs text-gray-400 dark:text-gray-500">
						{#if timeUnitPrice === 'perMonth'}
							monthly
						{:else if timeUnitPrice === 'perHour'}
							hourly
						{/if}
					</span>
				</div>
				<div class="text-xs text-gray-500 dark:text-gray-400">
					{vatSuffix}
					{#if config.markup_percentage !== null && config.markup_percentage > 0}
						<span class="ml-1">·</span>
						<span class="ml-1" style={`color: hsl(${markupColorHue()}, 100%, 40%)`}
							>{(config.markup_percentage ?? 0).toFixed(0)}%</span
						>
						higher than best
					{/if}
				</div>
			</div>
			{#if buttons}{@render buttons()}{/if}
		</div>
	{/if}
</Card>
<ServerDetailDrawer bind:hidden={drawerHidden} config={selectedConfig} />
