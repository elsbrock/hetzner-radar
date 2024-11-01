<script lang="ts">
    import { type ServerConfiguration } from "$lib/queries/filter";
    import { getFormattedDiskSize } from "$lib/disksize";
    import { faMemory, faHardDrive, faSdCard } from "@fortawesome/free-solid-svg-icons";
    import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
    import { Card, Badge, Spinner, Indicator } from "flowbite-svelte";
    import dayjs from 'dayjs';
  	import relativeTime from 'dayjs/plugin/relativeTime';
	  dayjs.extend(relativeTime);

    export let config: ServerConfiguration;
    export let displayRamPrice: 'none' | 'perGB' | 'perTB' = 'none';
    export let displayStoragePrice: 'none' | 'perGB' | 'perTB' = 'none';
    export let displayMarkupPercentage: boolean = false;

    export let loading: boolean = false;

    let classes: string;
    const defaultClasses = "relative group text-left flex flex-col justify-between min-h-[240px] sm:min-h-[220px] md:min-h-[240px] lg:min-h-[240px] bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300";

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
        console.log(totalPrice, size);
        return `${(totalPrice / (size / 1000)).toFixed(2)} €/TB`;
      }
      return '';
    }

    function getTotalStorageSize(config: ServerConfiguration): number {
      let total = 0;
      const storageTypes = [
        config.nvme_drives,
        config.sata_drives,
        config.hdd_drives,
      ];
      storageTypes.forEach(drives => {
        for (const num of drives) {
          total += num;
        }
      });
      return total;
    }

    $: if (config && config.markup_percentage === 0) {
      classes = `${defaultClasses} border-l-4 border-l-green-500`;
    } else {
      classes = defaultClasses;
    }
</script>

<Card class={classes} data-testid="server-card">
    {#if loading}
      <!-- Loading Spinner -->
      <div class="flex items-center justify-center h-full">
        <Spinner />
      </div>
    {:else}
      <!-- Main Content -->
      <div class="flex-grow">
        <h5 class="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">
          {config.cpu}
        </h5>
        <div class="text-gray-400 text-xs mb-3">
          <span class="inline-flex items-center">
            {#if dayjs.unix(config.last_seen) > dayjs().subtract(80, 'minutes')}
              <Indicator color="green" class="animate-pulse mr-2" size="xs" />
            {:else}
              <Indicator color="red" class="mr-2" size="xs" />
            {/if}
            seen {dayjs.unix(config.last_seen).fromNow()}
          </span>
        </div>
        <p class="font-normal text-gray-700 dark:text-gray-400 leading-tight">
          <FontAwesomeIcon icon={faMemory} class="me-1 w-4" /> RAM
          {config.ram_size} GB<br />
          {#if config.nvme_drives.length > 0}
            <FontAwesomeIcon icon={faSdCard} class="me-1 w-4" /> NVMe
            {summarizeNumbers(config.nvme_drives).map(d => `${d.count}× ${getFormattedDiskSize(d.value, 1)}`).join(", ")}
            <br />
          {/if}
          {#if config.sata_drives.length > 0}
            <FontAwesomeIcon icon={faSdCard} class="me-1 w-4" /> SATA
            {summarizeNumbers(config.sata_drives).map(d => `${d.count}× ${getFormattedDiskSize(d.value, 1)}`).join(", ")}
            <br />
          {/if}
          {#if config.hdd_drives.length > 0}
            <FontAwesomeIcon icon={faHardDrive} class="me-1 w-4" /> HDD
            {summarizeNumbers(config.hdd_drives).map(d => `${d.count}× ${getFormattedDiskSize(d.value, 1)}`).join(", ")}
            <br />
          {/if}
        </p>
        <div class="mt-3 flex flex-wrap gap-2">
          {#if config.is_ecc}<span><Badge border>ECC</Badge></span>{/if}
          {#if config.with_inic}<span><Badge border>iNIC</Badge></span>{/if}
          {#if config.with_gpu}<span><Badge border>GPU</Badge></span>{/if}
          {#if config.with_rps}<span><Badge border>RPS</Badge></span>{/if}
        </div>
      </div>
      
      <!-- Footer -->
      <div class="flex justify-between items-center mt-4">
        <div>
          <span>
            <span class="text-xl font-bold text-gray-900 dark:text-white">
                {config.price} €
            </span>
            +VAT
          </span>
          {#if displayRamPrice !== 'none' || displayStoragePrice !== 'none' || displayMarkupPercentage}
            <div class="text-gray-400 text-xs">
              {#if displayRamPrice !== 'none'}
                {calculatePricePerUnit(config.price, config.ram_size, displayRamPrice)} RAM<br />
              {/if}
              {#if displayStoragePrice !== 'none'}
                {calculatePricePerUnit(config.price, getTotalStorageSize(config), displayStoragePrice)} Storage
              {/if}
              {#if displayMarkupPercentage}
                <span class="text-gray-500">
                  {#if config.markup_percentage > 0}
                    <span style={`color: hsl(${Math.max(0, Math.min(120, 120 *
                    (10 - config.markup_percentage) / 10))}, 70%,
                    50%);`}>{config.markup_percentage}%</span> higher than best
                  {:else}
                    best price
                  {/if}
                </span>
              {/if}
            </div>
          {/if}
        </div>
        <slot name="buttons" />
      </div>
    {/if}
</Card>
