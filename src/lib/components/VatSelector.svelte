<script context="module" lang="ts">
	// Define the available VAT options - moved to module context for external import
	// EU: https://europa.eu/youreurope/business/taxation/vat/vat-rules-rates/index_en.htm
	// EFTA: https://taxsummaries.pwc.com/
	export const vatOptions = {
		NET: { name: 'Others (Net)', rate: 0, flag: '🌎' },
		AT: { name: 'Austria', rate: 0.2, flag: '🇦🇹' },
		BE: { name: 'Belgium', rate: 0.21, flag: '🇧🇪' },
		BG: { name: 'Bulgaria', rate: 0.2, flag: '🇧🇬' },
		CH: { name: 'Switzerland', rate: 0.081, flag: '🇨🇭' },
		HR: { name: 'Croatia', rate: 0.25, flag: '🇭🇷' },
		CY: { name: 'Cyprus', rate: 0.19, flag: '🇨🇾' },
		CZ: { name: 'Czech Republic', rate: 0.21, flag: '🇨🇿' },
		DK: { name: 'Denmark', rate: 0.25, flag: '🇩🇰' },
		EE: { name: 'Estonia', rate: 0.22, flag: '🇪🇪' },
		FI: { name: 'Finland', rate: 0.24, flag: '🇫🇮' },
		FR: { name: 'France', rate: 0.2, flag: '🇫🇷' },
		DE: { name: 'Germany', rate: 0.19, flag: '🇩🇪' },
		GR: { name: 'Greece', rate: 0.24, flag: '🇬🇷' },
		HU: { name: 'Hungary', rate: 0.27, flag: '🇭🇺' },
		IS: { name: 'Iceland', rate: 0.24, flag: '🇮🇸' },
		IE: { name: 'Ireland', rate: 0.23, flag: '🇮🇪' },
		IT: { name: 'Italy', rate: 0.22, flag: '🇮🇹' },
		LV: { name: 'Latvia', rate: 0.21, flag: '🇱🇻' },
		LI: { name: 'Liechtenstein', rate: 0.081, flag: '🇱🇮' },
		LT: { name: 'Lithuania', rate: 0.21, flag: '🇱🇹' },
		LU: { name: 'Luxembourg', rate: 0.17, flag: '🇱🇺' },
		MT: { name: 'Malta', rate: 0.18, flag: '🇲🇹' },
		NL: { name: 'Netherlands', rate: 0.21, flag: '🇳🇱' },
		NO: { name: 'Norway', rate: 0.25, flag: '🇳🇴' },
		PL: { name: 'Poland', rate: 0.23, flag: '🇵🇱' },
		PT: { name: 'Portugal', rate: 0.23, flag: '🇵🇹' },
		RO: { name: 'Romania', rate: 0.19, flag: '🇷🇴' },
		SK: { name: 'Slovakia', rate: 0.2, flag: '🇸🇰' },
		SI: { name: 'Slovenia', rate: 0.22, flag: '🇸🇮' },
		ES: { name: 'Spain', rate: 0.21, flag: '🇪🇸' },
		SE: { name: 'Sweden', rate: 0.25, flag: '🇸🇪' },
		GB: { name: 'United Kingdom', rate: 0.2, flag: '🇬🇧' }
	};
</script>

<script lang="ts">
	import { settingsStore } from '$lib/stores/settings';
	import { Select, ButtonGroup, InputAddon } from 'flowbite-svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faPercentage } from '@fortawesome/free-solid-svg-icons';

	// Intermediate variable for two-way binding, initialized from store
	let selectedCountryCode = $settingsStore.vatSelection?.countryCode || 'None';

	// Helper to format the option text - updated for brevity
	function formatOptionText(flag: string, name: string, rate: number): string {
		if (rate > 0) {
			return `${flag} ${(rate * 100).toFixed(0)}%`; // e.g., 🇩🇪 19%
		}
		return `${flag} 0% (others)`; // e.g., 💼 Net
	}

	function handleVatChange() {
		const selectedOption = vatOptions[selectedCountryCode as keyof typeof vatOptions];
		const ratePercentage = selectedOption ? Math.round(selectedOption.rate * 100) : 0; // Calculate integer percentage

		// Update both country code selection and the calculated rate in the store
		settingsStore.updateSetting('vatSelection', { countryCode: selectedCountryCode });
		settingsStore.updateSetting('currentVatRate', ratePercentage);
	}
</script>

<ButtonGroup size="sm">
	<InputAddon
		size="sm"
		class="bg-gray-50 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
	>
		<FontAwesomeIcon icon={faPercentage} class="mr-2" />VAT
	</InputAddon>
	<Select
		id="vat-select"
		bind:value={selectedCountryCode}
		onchange={handleVatChange}
		items={Object.entries(vatOptions).map(([code, option]) => ({
			value: code,
			name: formatOptionText(option.flag, option.name, option.rate)
		}))}
		size="sm"
		class="w-24 rounded-s-none! bg-white text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-white"
	/>
</ButtonGroup>
