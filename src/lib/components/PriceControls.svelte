<script lang="ts">
	import { settingsStore } from '$lib/stores/settings';
	import VatSelector from '$lib/components/VatSelector.svelte';
	import CurrencySelector from '$lib/components/CurrencySelector.svelte';
	import { Button, ButtonGroup, Tooltip, InputAddon } from 'flowbite-svelte';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faClock } from '@fortawesome/free-solid-svg-icons';

	// Default to 'perMonth' if not set in the store yet
	$: timeUnitPrice = $settingsStore.timeUnitPrice ?? 'perMonth';

	function setTimeUnitPrice(unit: 'perHour' | 'perMonth') {
		settingsStore.updateSetting('timeUnitPrice', unit);
	}
</script>

<!-- Outer container for relative positioning and fade effect -->
<div
	data-testid="price-controls"
	class="relative text-xs text-gray-900 after:pointer-events-none after:absolute after:top-0 after:right-0 after:bottom-0 after:w-8 after:bg-gradient-to-l after:from-white after:to-transparent after:content-[''] md:after:hidden dark:text-white after:dark:from-gray-800"
>
	<!-- Inner container for scrolling content -->
	<div class="scrollbar-hide flex flex-nowrap items-center gap-3 overflow-x-auto">
		<ButtonGroup class="flex-shrink-0">
			<InputAddon
				size="sm"
				class="bg-gray-50 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
			>
				<FontAwesomeIcon icon={faClock} class="mr-2" /> Rate
			</InputAddon>
			<Button
				class="px-2"
				size="xs"
				checked={timeUnitPrice === 'perHour'}
				on:click={() => setTimeUnitPrice('perHour')}>hourly</Button
			>
			<Button
				class="px-2"
				size="xs"
				checked={timeUnitPrice === 'perMonth'}
				on:click={() => setTimeUnitPrice('perMonth')}>monthly</Button
			>
		</ButtonGroup>
		<Tooltip placement="left" class="z-50 flex-shrink-0">
			Display prices per hour or per month.
		</Tooltip>
		<div class="flex-shrink-0"><CurrencySelector /></div>
		<div class="flex-shrink-0"><VatSelector /></div>
	</div>
</div>
