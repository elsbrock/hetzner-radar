<script lang="ts">
	import { Popover, Toggle, ButtonGroup, Button } from 'flowbite-svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faGear, faSun, faMoon, faDesktop } from '@fortawesome/free-solid-svg-icons';
	import { settingsStore } from '$lib/stores/settings';
	import { CURRENCY_CONFIG, DEFAULT_CURRENCY, type CurrencyCode } from '$lib/currency';
	import { vatOptions } from '$lib/components/VatSelector.svelte';

	// Generate unique ID for each instance
	const instanceId = `settings-popover-${Math.random().toString(36).slice(2, 9)}`;

	// Settings state
	$: timeUnitPrice = $settingsStore.timeUnitPrice ?? 'perMonth';
	$: isMonthly = timeUnitPrice === 'perMonth';
	$: currentTheme = ($settingsStore.theme as 'light' | 'dark' | 'system') ?? 'system';
	$: selectedCurrency = ($settingsStore.currencySelection?.code || DEFAULT_CURRENCY) as CurrencyCode;
	$: selectedVat = $settingsStore.vatSelection?.countryCode || 'NET';

	function togglePriceUnit() {
		settingsStore.updateSetting('timeUnitPrice', isMonthly ? 'perHour' : 'perMonth');
	}

	function setTheme(theme: 'light' | 'dark' | 'system') {
		settingsStore.updateSetting('theme', theme);
		applyTheme(theme);
	}

	function applyTheme(theme: 'light' | 'dark' | 'system') {
		if (theme === 'system') {
			const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
			document.documentElement.classList.toggle('dark', prefersDark);
		} else {
			document.documentElement.classList.toggle('dark', theme === 'dark');
		}
	}

	function handleCurrencyChange(event: Event) {
		const code = (event.target as HTMLSelectElement).value as CurrencyCode;
		settingsStore.updateSetting('currencySelection', { code });
		if (code === 'USD') {
			settingsStore.updateSetting('vatSelection', { countryCode: 'NET' });
			settingsStore.updateSetting('currentVatRate', 0);
		}
	}

	function handleVatChange(event: Event) {
		const countryCode = (event.target as HTMLSelectElement).value;
		const option = vatOptions[countryCode as keyof typeof vatOptions];
		settingsStore.updateSetting('vatSelection', { countryCode });
		settingsStore.updateSetting('currentVatRate', option ? Math.round(option.rate * 100) : 0);
	}
</script>

<!-- Settings button -->
<button
	id={instanceId}
	class="flex aspect-square h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 focus:outline-hidden focus:ring-2 focus:ring-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-700"
	aria-label="Settings"
>
	<FontAwesomeIcon icon={faGear} class="h-4 w-4" />
</button>

<!-- Settings Popover -->
<Popover
	triggeredBy={`#${instanceId}`}
	trigger="click"
	placement="bottom-end"
	class="settings-popover z-50 w-72 border border-gray-200 bg-white text-sm shadow-lg dark:border-gray-600 dark:bg-gray-800"
>
	<div class="space-y-3 py-1">
		<!-- Appearance Section -->
		<div>
			<div class="mb-1.5 px-2 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
				Appearance
			</div>
			<div class="flex items-center justify-between px-2 py-1.5">
				<span class="text-gray-700 dark:text-gray-300">Theme</span>
				<ButtonGroup size="xs">
					<Button
						color={currentTheme === 'light' ? 'primary' : 'alternative'}
						onclick={() => setTheme('light')}
						class="px-2"
					>
						<FontAwesomeIcon icon={faSun} class="h-3 w-3" />
					</Button>
					<Button
						color={currentTheme === 'system' ? 'primary' : 'alternative'}
						onclick={() => setTheme('system')}
						class="px-2"
					>
						<FontAwesomeIcon icon={faDesktop} class="h-3 w-3" />
					</Button>
					<Button
						color={currentTheme === 'dark' ? 'primary' : 'alternative'}
						onclick={() => setTheme('dark')}
						class="px-2"
					>
						<FontAwesomeIcon icon={faMoon} class="h-3 w-3" />
					</Button>
				</ButtonGroup>
			</div>
		</div>

		<!-- Pricing Section -->
		<div>
			<div class="mb-1.5 px-2 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
				Pricing
			</div>
			<div class="flex items-center justify-between px-2 py-1.5">
				<span class="text-gray-700 dark:text-gray-300">Monthly prices</span>
				<Toggle size="small" checked={isMonthly} on:change={togglePriceUnit} />
			</div>
			<div class="flex items-center justify-between px-2 py-1.5">
				<span class="text-gray-700 dark:text-gray-300">Currency</span>
				<select
					value={selectedCurrency}
					on:change={handleCurrencyChange}
					class="rounded-sm border border-gray-300 bg-gray-50 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-white"
				>
					{#each Object.entries(CURRENCY_CONFIG) as [code, config] (code)}
						<option value={code}>{config.flag} {code}</option>
					{/each}
				</select>
			</div>
			<div class="flex items-center justify-between px-2 py-1.5">
				<span class="text-gray-700 dark:text-gray-300">VAT</span>
				<select
					value={selectedVat}
					on:change={handleVatChange}
					disabled={selectedCurrency === 'USD'}
					class="rounded-sm border border-gray-300 bg-gray-50 px-2 py-1 text-xs disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
				>
					{#each Object.entries(vatOptions) as [code, option] (code)}
						<option value={code}>
							{option.flag}
							{#if option.rate > 0}
								{(option.rate * 100).toFixed(0)}%
							{:else}
								0%
							{/if}
						</option>
					{/each}
				</select>
			</div>
		</div>
	</div>
</Popover>

<style>
	:global(.settings-popover > div[data-popper-arrow]) {
		z-index: -1;
	}
</style>