<script lang="ts">
	import { settingsStore } from '$lib/stores/settings';
	import { Select, ButtonGroup, InputAddon } from 'flowbite-svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faDollarSign } from '@fortawesome/free-solid-svg-icons';
	import { CURRENCY_CONFIG, DEFAULT_CURRENCY, type CurrencyCode } from '$lib/currency';

	// Intermediate variable for two-way binding, initialized from store
	let selectedCurrencyCode = ($settingsStore.currencySelection?.code || DEFAULT_CURRENCY) as CurrencyCode;

	// Helper to format the option text
	function formatOptionText(code: string, flag: string, symbol: string): string {
		return `${flag} ${code}`; // e.g., 🇪🇺 EUR
	}

	function handleCurrencyChange() {
		// Update currency selection in the store
		settingsStore.updateSetting('currencySelection', { code: selectedCurrencyCode });
		
		// When USD is selected, automatically set VAT to NET (0%)
		if (selectedCurrencyCode === 'USD') {
			settingsStore.updateSetting('vatSelection', { countryCode: 'NET' });
			settingsStore.updateSetting('currentVatRate', 0);
		}
	}
</script>

<ButtonGroup size="xs">
	<InputAddon
		size="sm"
		class="bg-gray-50 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
	>
		<FontAwesomeIcon icon={faDollarSign} class="mr-2" />Currency
	</InputAddon>
	<Select
		id="currency-select"
		bind:value={selectedCurrencyCode}
		on:change={handleCurrencyChange}
		items={Object.entries(CURRENCY_CONFIG).map(([code, option]) => ({
			value: code,
			name: formatOptionText(code, option.flag, option.symbol)
		}))}
		size="sm"
		class="w-24 rounded-s-none! bg-white text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-white"
	/>
</ButtonGroup>