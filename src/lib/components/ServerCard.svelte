<script lang="ts">
    import { type ServerConfiguration } from "$lib/dbapi";
    import { getFormattedDiskSize } from "$lib/disksize";
    import {
      getFilterString,
      convertServerConfigurationToFilter,
    } from "$lib/filter";
    import { faMemory, faHardDrive } from "@fortawesome/free-solid-svg-icons";
    import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
    import { Card, Badge, Button, Spinner } from "flowbite-svelte"; // Import Spinner from Flowbite-Svelte

    export let config: ServerConfiguration;

    // New Props for Configurable Price Display
    export let displayRamPrice: 'none' | 'perGB' | 'perTB' = 'none';
    export let displayStoragePrice: 'none' | 'perGB' | 'perTB' = 'none';

    // New Prop for Loading State
    export let loading: boolean = false;

    interface NumberSummary {
      count: number;
      value: number;
    }

    function summarizeNumbers(numbers: number[]): NumberSummary[] {
        const counts = new Map<number, number>();
        const order: number[] = [];

        for (const num of numbers) {
            if (counts.has(num)) {
                counts.set(num, counts.get(num)! + 1);
            } else {
                counts.set(num, 1);
                order.push(num); // Preserve the order of first occurrence
            }
        }

        const result: NumberSummary[] = [];

        for (const num of order) {
            const count = counts.get(num)!;
            result.push({ count, value: num });
        }

        return result;
    }

    function calculatePricePerUnit(totalPrice: number, size: number, unit: 'perGB' | 'perTB'): string {
      if (unit === 'perGB') {
        return `${(totalPrice / size).toFixed(2)} €/GB`;
      } else if (unit === 'perTB') {
        return `${(totalPrice / (size / 1024)).toFixed(2)} €/TB`;
      }
      return '';
    }

    function getTotalStorageSize(): number {
      let total = 0;
      const storageTypes = [config.nvme_drives, config.sata_drives, config.hdd_drives];
      storageTypes.forEach(drives => {
        drives.toArray().forEach(drive => {
          total += drive;
        });
      });
      return total; // Assuming drive.value is in GB
    }
</script>

<Card class="text-left mb-6 flex flex-col justify-between min-h-[240px] sm:min-h-[220px] md:min-h-[240px] lg:min-h-[240px] bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 p-6">
    {#if loading}
      <!-- Loading Spinner -->
      <div class="flex items-center justify-center h-full">
        <Spinner />
      </div>
    {:else}
      <!-- Main Content -->
      <div class="flex-grow">
        <h5 class="mb-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          {config.cpu}
        </h5>
        <div class="mb-3 flex flex-wrap gap-2">
          {#if config.is_ecc}<span><Badge border>ECC</Badge></span>{/if}
          {#if config.with_inic}<span><Badge border>iNIC</Badge></span>{/if}
          {#if config.with_gpu}<span><Badge border>GPU</Badge></span>{/if}
          {#if config.with_rps}<span><Badge border>RPS</Badge></span>{/if}
        </div>
        <p class="font-normal text-gray-700 dark:text-gray-400 leading-tight">
          <FontAwesomeIcon icon={faMemory} class="me-1 w-4" />
          {config.ram_size} GB RAM<br />
          {#if config.nvme_drives.length > 0}
            <FontAwesomeIcon icon={faHardDrive} class="me-1 w-4" /> NVMe
            {#each summarizeNumbers(config.nvme_drives) as { count, value }}
              {count}× {getFormattedDiskSize(value / 250)}
            {/each}
            <br />
          {/if}
          {#if config.sata_drives.length > 0}
            <FontAwesomeIcon icon={faHardDrive} class="me-1 w-4" /> SATA
            {#each summarizeNumbers(config.sata_drives) as { count, value }}
              {count}× {getFormattedDiskSize(value / 250)}
            {/each}
            <br />
          {/if}
          {#if config.hdd_drives.length > 0}
            <FontAwesomeIcon icon={faHardDrive} class="me-1 w-4" /> HDD
            {#each summarizeNumbers(config.hdd_drives) as { count, value }}
              {count}× {getFormattedDiskSize(value / 500)}
            {/each}
            <br />
          {/if}
        </p>
      </div>
      
      <!-- Footer -->
      <div class="flex justify-between items-center mt-4">
        <div>
          <span>
            <span class="text-xl font-bold text-gray-900 dark:text-white">
                {config.price} €
            </span>
            + VAT
          </span>
          {#if displayRamPrice !== 'none' || displayStoragePrice !== 'none'}
            <div class="text-gray-400 text-xs">
              {#if displayRamPrice !== 'none'}
                {calculatePricePerUnit(config.price, config.ram_size, displayRamPrice)} RAM<br />
              {/if}
              {#if displayStoragePrice !== 'none'}
                {calculatePricePerUnit(config.price, getTotalStorageSize(), displayStoragePrice)} Storage
              {/if}
            </div>
          {/if}
        </div>
        <Button
          outline
          href="/analyze#filter.v2:{getFilterString(convertServerConfigurationToFilter(config))}"
          class="px-4 py-2 text-sm"
        >
          Find
        </Button>
      </div>
    {/if}
</Card>
