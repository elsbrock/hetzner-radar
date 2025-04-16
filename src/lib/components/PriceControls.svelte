<script lang="ts">
  import { settingsStore } from '$lib/stores/settings';
  import VatSelector from '$lib/components/VatSelector.svelte';
  import { Button, ButtonGroup, Tooltip, InputAddon } from 'flowbite-svelte';
  import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
  import { faClock } from '@fortawesome/free-solid-svg-icons';

  // Default to 'perHour' if not set in the store yet
  $: timeUnitPrice = $settingsStore.timeUnitPrice ?? 'perHour';

  function setTimeUnitPrice(unit: 'perHour' | 'perMonth') {
    settingsStore.updateSetting('timeUnitPrice', unit);
  }
</script>

<div class="text-xs text-gray-900 dark:text-white flex items-center space-x-4">
    <ButtonGroup>
        <InputAddon size="sm" class="bg-gray-50 text-gray-900">
            <FontAwesomeIcon
                icon={faClock}
                class="mr-2"
            /> Rate
        </InputAddon>
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