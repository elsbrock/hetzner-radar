<script lang="ts">
	import { Button, Dropdown, DropdownItem } from 'flowbite-svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faGear } from '@fortawesome/free-solid-svg-icons';
	import { settingsStore } from '$lib/stores/settings';
	import VatSelector from '$lib/components/VatSelector.svelte';
	import CurrencySelector from '$lib/components/CurrencySelector.svelte';
	import { faClock } from '@fortawesome/free-solid-svg-icons';

	// Default to 'perMonth' if not set in the store yet
	$: timeUnitPrice = $settingsStore.timeUnitPrice ?? 'perMonth';

	function setTimeUnitPrice(unit: 'perHour' | 'perMonth') {
		settingsStore.updateSetting('timeUnitPrice', unit);
	}
</script>

<!-- Settings button with gear icon -->
<Button
	color="alternative" 
	class="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
	aria-label="Settings"
>
	<FontAwesomeIcon icon={faGear} class="h-4 w-4" />
</Button>

<!-- Settings dropdown menu -->
<Dropdown
	class="w-72 p-3 space-y-3 text-sm dark:bg-gray-800 dark:border-gray-700"
	placement="bottom-end"
>
	<!-- Price Unit Settings -->
	<div class="space-y-2">
		<div class="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center">
			<FontAwesomeIcon icon={faClock} class="mr-2 h-3 w-3" /> Price Display
		</div>
		<div class="flex gap-2">
			<Button
				size="xs"
				color={timeUnitPrice === 'perHour' ? 'primary' : 'alternative'}
				class="flex-1"
				on:click={() => setTimeUnitPrice('perHour')}
			>
				Hourly
			</Button>
			<Button
				size="xs"
				color={timeUnitPrice === 'perMonth' ? 'primary' : 'alternative'}
				class="flex-1"
				on:click={() => setTimeUnitPrice('perMonth')}
			>
				Monthly
			</Button>
		</div>
	</div>

	<!-- Divider -->
	<hr class="border-gray-200 dark:border-gray-700" />

	<!-- Currency Settings -->
	<div class="space-y-2">
		<div class="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
			Currency & Tax
		</div>
		<div class="space-y-2">
			<CurrencySelector />
			<VatSelector />
		</div>
		{#if $settingsStore.currencySelection?.code === 'USD'}
			<p class="text-xs text-gray-500 dark:text-gray-400 italic">
				VAT is automatically set to 0% for USD.
			</p>
		{/if}
	</div>
</Dropdown>