<script lang="ts">
  import { settingsStore } from '$lib/stores/settings';
  import { Select, Label } from 'flowbite-svelte'; // Import Select and Label

  // Define the available VAT options
  export const vatOptions = {
    'DE': { name: 'Germany', rate: 0.19, flag: '🇩🇪' },
    'NET': { name: 'Business (Net)', rate: 0, flag: '💼' }
  };

  // Intermediate variable for two-way binding
  let selectedCountryCode = $settingsStore.vatSelection.countryCode;

  // Reactive statements to keep store and local variable in sync
  $: $settingsStore.vatSelection.countryCode = selectedCountryCode;
  $: selectedCountryCode = $settingsStore.vatSelection.countryCode;

  // Helper to format the option text
  function formatOptionText(flag: string, name: string, rate: number): string {
    if (rate > 0) {
      return `${flag} ${name} (${(rate * 100).toFixed(0)}%)`;
    }
    return `${flag} ${name}`;
  }
</script>

<!-- VAT Selector UI -->
<div class="flex items-center space-x-2">
  <Label for="vat-select" class="whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">Price Display:</Label>
  <Select
    id="vat-select"
    bind:value={selectedCountryCode}
    items={Object.entries(vatOptions).map(([code, option]) => ({
      value: code,
      name: formatOptionText(option.flag, option.name, option.rate)
    }))}
    size="sm"  />
</div>
