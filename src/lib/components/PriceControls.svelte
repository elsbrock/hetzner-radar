<script lang="ts">
  import { settingsStore } from '$lib/stores/settings';
  import VatSelector from '$lib/components/VatSelector.svelte';
  import { Button, ButtonGroup, Tooltip } from 'flowbite-svelte';
  import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
  import { faEuroSign } from '@fortawesome/free-solid-svg-icons';

  // Default to 'perHour' if not set in the store yet
  $: timeUnitPrice = $settingsStore.timeUnitPrice ?? 'perHour';

  function setTimeUnitPrice(unit: 'perHour' | 'perMonth') {
    settingsStore.updateSetting('timeUnitPrice', unit);
  }
</script>

<div class="text-xs text-gray-900 dark:text-white flex items-center space-x-4">
    <ButtonGroup>
        <div
            class="text-center font-medium focus-within:ring-2 focus-within:z-10 inline-flex items-center justify-center px-2 py-2 bg-gray-50 border border-gray-200 first:rounded-s-lg last:rounded-e-lg opacity-90 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        >
            <FontAwesomeIcon
                icon={faEuroSign}
                class="mr-2"
            /> Rate
        </div>
        <Button
            class="px-2"
            size="xs"
            checked={timeUnitPrice === 'perHour'}
            on:click={() => setTimeUnitPrice('perHour')}
            >hourly</Button
        >
        <Button
            class="px-2"
            size="xs"
            checked={timeUnitPrice === 'perMonth'}
            on:click={() => setTimeUnitPrice('perMonth')}
            >monthly</Button
        >
    </ButtonGroup>
    <Tooltip placement="left" class="z-50">
        Display prices per hour or per month.
    </Tooltip>
    <VatSelector />
</div>