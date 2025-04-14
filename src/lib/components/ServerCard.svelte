<script lang="ts">
    import { type ServerConfiguration } from "$lib/api/frontend/filter";
    import { getFormattedDiskSize } from "$lib/disksize";
    import {
        faHardDrive,
        faMemory,
        faSdCard,
    } from "@fortawesome/free-solid-svg-icons";
    import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
    import dayjs from "dayjs";
    import relativeTime from "dayjs/plugin/relativeTime";
    import { Badge, Card, Indicator, Spinner } from "flowbite-svelte";
    dayjs.extend(relativeTime);
    import { settingsStore } from '$lib/stores/settings';
    import { vatOptions } from './VatSelector.svelte';
import ServerDetailDrawer from './ServerDetailDrawer.svelte';

    export let timeUnitPrice: "perMonth" | "perHour" = "perHour";
    export let config: ServerConfiguration;
    export let displayRamPrice: "none" | "perGB" | "perTB" = "none";
    export let displayStoragePrice: "none" | "perGB" | "perTB" = "none";
    export let displayMarkupPercentage: boolean = false;

    export let loading: boolean = false;
    let drawerOpen = false;
    let selectedConfig: ServerConfiguration | null = null;

    // VAT related reactive variables
    // Define the type for VAT option keys based on the imported value
    type VatCountryCode = keyof typeof vatOptions;
    // VAT related reactive variables with improved type safety
    $: countryCode = $settingsStore.vatSelection.countryCode;
    $: validCountryCode = (countryCode && countryCode in vatOptions) ? countryCode as VatCountryCode : 'NET';
    $: selectedOption = vatOptions[validCountryCode];
    $: displayPrice = (config.price ?? 0) * (1 + selectedOption.rate);
    $: vatSuffix = selectedOption.rate > 0 ? `(${(selectedOption.rate * 100).toFixed(0)}% VAT)` : '(net)';

    let classes: string;
    const defaultClasses =
        "relative group text-left flex flex-col justify-between min-h-[210px] sm:min-h-[210px] md:min-h-[210px] lg:min-h-[210px] bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 hover:cursor-pointer";
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

    function calculatePricePerUnit(
        totalPrice: number,
        size: number,
        unit: "perGB" | "perTB",
    ): string {
        if (unit === "perGB") {
            return `${(totalPrice / size).toFixed(2)} € per GB`;
        } else if (unit === "perTB") {
            console.log(totalPrice, size);
            return `${(totalPrice / (size / 1000)).toFixed(2)} € per TB`;
        }
        return "";
    }

    function getTotalStorageSize(config: ServerConfiguration): number {
        let total = 0;
        const storageTypes = [
            config.nvme_drives,
            config.sata_drives,
            config.hdd_drives,
        ];
        storageTypes.forEach((drives) => {
            for (const num of drives) {
                total += num;
            }
        });
        return total;
    }

    // Reactive classes based on markup and drawer state
    $: {
    	let currentClasses = defaultClasses;
    	if (config && config.markup_percentage === 0) {
    		currentClasses += ' border-l-4 border-l-green-500';
    	}
    	classes = currentClasses;
    }
</script>

<Card
    class={classes}
    data-testid="server-card"
    style="padding: 15px"
    on:click={() => {
        selectedConfig = config;
        drawerOpen = true;
    }}
>
    {#if loading}
        <!-- Loading Spinner -->
        <div class="flex items-center justify-center h-full">
            <Spinner />
        </div>
    {:else}
        <!-- Main Content -->
        <div class="flex-grow">
            <h5
                class="text-xl font-semibold tracking-tight text-gray-900 dark:text-white"
            >
                {config.cpu}
            </h5>
            <div class="text-gray-400 text-xs mb-3">
                <span class="inline-flex items-center">
                    {#if dayjs.unix(config.last_seen ?? 0) > dayjs().subtract(80, "minutes")}
                        <Indicator
                            color="green"
                            class="animate-pulse mr-2"
                            size="xs"
                        />
                    {:else}
                        <Indicator color="red" class="mr-2" size="xs" />
                    {/if}
                    seen {config.last_seen ? dayjs.unix(config.last_seen).fromNow() : 'unknown'}
                </span>
            </div>

            <!-- Aligned Hardware Details -->
            <div
                class="font-normal text-gray-700 dark:text-gray-400 leading-tight grid grid-cols-[50px,1fr] gap-x-3"
            >
                <!-- RAM -->
                <div class="flex items-center">
                    <FontAwesomeIcon icon={faMemory} class="me-1 w-4" />
                    RAM
                </div>
                <div>
                    {config.ram_size} GB
                </div>

                <!-- NVMe Drives -->
                {#if config.nvme_drives.length > 0}
                    <div class="flex items-center">
                        <FontAwesomeIcon icon={faSdCard} class="me-1 w-4" />
                        NVMe
                    </div>
                    <div>
                        {summarizeNumbers(config.nvme_drives)
                            .map(
                                (d) =>
                                    `${d.count}× ${getFormattedDiskSize(d.value, 1)}`,
                            )
                            .join(", ")}
                    </div>
                {/if}

                <!-- SATA Drives -->
                {#if config.sata_drives.length > 0}
                    <div class="flex items-center">
                        <FontAwesomeIcon icon={faSdCard} class="me-1 w-4" />
                        SATA
                    </div>
                    <div>
                        {summarizeNumbers(config.sata_drives)
                            .map(
                                (d) =>
                                    `${d.count}× ${getFormattedDiskSize(d.value, 1)}`,
                            )
                            .join(", ")}
                    </div>
                {/if}

                <!-- HDD Drives -->
                {#if config.hdd_drives.length > 0}
                    <div class="flex items-center">
                        <FontAwesomeIcon icon={faHardDrive} class="me-1 w-4" />
                        HDD
                    </div>
                    <div>
                        {summarizeNumbers(config.hdd_drives)
                            .map(
                                (d) =>
                                    `${d.count}× ${getFormattedDiskSize(d.value, 1)}`,
                            )
                            .join(", ")}
                    </div>
                {/if}
            </div>

            <!-- Badges -->
            <div class="mt-3 flex flex-wrap gap-2">
                {#if config.is_ecc}<span><Badge border>ECC</Badge></span>{/if}
                {#if config.with_inic}<span><Badge border>iNIC</Badge></span
                    >{/if}
                {#if config.with_gpu}<span><Badge border>GPU</Badge></span>{/if}
                {#if config.with_hwr}<span><Badge border>HWR</Badge></span>{/if}
                {#if config.with_rps}<span><Badge border>RPS</Badge></span>{/if}
            </div>
        </div>

        <!-- Footer -->
        <div class="flex justify-between items-center mt-4">
            <div>
                <span>
                    <span
                        class="text-xl font-bold text-gray-900 dark:text-white"
                    >
                        {#if timeUnitPrice === "perMonth"}
                            {displayPrice.toFixed(2)} €
                        {:else if timeUnitPrice === "perHour"}
                            {(displayPrice / (30 * 24)).toFixed(4)} €
                        {/if}
                    </span>
                    <span class="text-sm text-gray-600 dark:text-gray-400 ml-1">{vatSuffix}</span>
                    <span class="text-gray-400 text-xs ml-1">
                        {#if timeUnitPrice === "perMonth"}
                            monthly
                        {:else if timeUnitPrice === "perHour"}
                            hourly
                        {/if}
                    </span>
                </span>
                {#if displayRamPrice !== "none" || displayStoragePrice !== "none" || displayMarkupPercentage}
                    <div class="text-gray-400 text-xs">
                        {#if displayRamPrice !== "none"}
                            {calculatePricePerUnit(
                                displayPrice, // Use VAT-adjusted price
                                config.ram_size,
                                displayRamPrice,
                            )} RAM/month
                        {/if}
                        {#if displayStoragePrice !== "none"}
                            {calculatePricePerUnit(
                                displayPrice, // Use VAT-adjusted price
                                getTotalStorageSize(config),
                                displayStoragePrice,
                            )} Storage/month
                        {/if}
                        {#if displayMarkupPercentage}
                        	<span class="text-gray-500">
                        		{#if (config.markup_percentage ?? 0) > 0}
                        			<span
                        				style={`color: hsl(${Math.max(
                        					0,
                        					Math.min(
                        						120,
                        						(120 *
                        							(10 -
                        								(config.markup_percentage ?? 0))) /
                        							10,
                        					),
                        				)}, 70%,
                       50%);`}>{(config.markup_percentage ?? 0).toFixed(0)}%</span
                        			> higher than best
                        		{:else}
                        			best price
                        		{/if}
                        	</span>
                        {/if}
                    </div>
                {/if}
            </div>
            <!-- Removed slot name="buttons" -->
        </div>
    {/if}
    <ServerDetailDrawer bind:open={drawerOpen} config={selectedConfig} />
</Card>
