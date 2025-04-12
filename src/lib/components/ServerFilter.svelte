<script lang="ts">
    // Removed goto import

    type SliderSizeType =
        | string
        | number
        | FileSizeReturnArray
        | FileSizeReturnObject;

    import { page } from "$app/stores";
    import type { NameValuePair } from "$lib/api/frontend/stats";
    import {
        getFormattedDiskSize,
        getFormattedMemorySize,
    } from "$lib/disksize";
    import {
        decodeFilterString,
        defaultFilter,
        encodeFilter,
        getFilterFromURL,
        loadFilter,
        type ServerFilter,
    } from "$lib/filter";
    import { filter as filterStore } from "$lib/stores/filter";
    import { addToast } from "$lib/stores/toast";
    import { debounce } from "$lib/util";
    import {
        faBoxesStacked,
        faGlobe,
        faHardDrive,
        faMemory,
        faMicrochip,
        faTags,
    } from "@fortawesome/free-solid-svg-icons";
    import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
    import type { FileSizeReturnArray, FileSizeReturnObject } from "filesize";
    import {
        Button,
        ButtonGroup,
        Label,
        MultiSelect,
        Toggle,
    } from "flowbite-svelte";
    import { onMount } from "svelte";
    import { RangeSlider } from "svelte-range-slider-pips";

    export let datacenters: NameValuePair[];
    export let cpuModels: NameValuePair[];

    const springValues = {
        stiffness: 1,
        damping: 1,
    };

    let filter: ServerFilter | null = null;
    let hasStoredFilter = false;

    onMount(() => {
        const urlFilter = getFilterFromURL($page.url.searchParams);
        const storedFilterValue = loadFilter();

        if (urlFilter) {
            filter = urlFilter;
            addToast({
                color: "green",
                message: "Using filter from URL",
                icon: "success",
            });
        } else if (storedFilterValue) {
            hasStoredFilter = true;
            filter = storedFilterValue;
            addToast({
                color: "green",
                message: "Using stored filter settings",
                icon: "success",
            });
        } else {
            filter = { ...defaultFilter };
        }
    });

    function updateUrl(newFilter: ServerFilter | null) {
        if (newFilter && typeof window !== 'undefined') { // Check for window object
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set('filter', encodeFilter(newFilter));
            // Use history.replaceState to update URL without navigation
            window.history.replaceState(window.history.state, '', newUrl.toString());
        }
    }

    const debouncedUpdateUrl = debounce(updateUrl, 500); // 500ms delay

    $: {
        // Update the store immediately for reactivity elsewhere (like data fetching)
        filterStore.set(filter);
        // Update the URL only after a delay
        debouncedUpdateUrl(filter);
    }

    // escape reactivity
    function updateFilterFromUrl(newFilter: ServerFilter | null) {
        filter = newFilter;
        filterStore.set(newFilter);
    }

    $: {
        const filterString = $page.url.searchParams.get("filter");
        if (filterString) {
            const decodedFilter = decodeFilterString(filterString);
            // Avoid infinite loop by checking if filter actually changed
            if (JSON.stringify(decodedFilter) !== JSON.stringify(filter)) {
                 updateFilterFromUrl(decodedFilter);
            }
        }
    }

    // Variables for displaying formatted sizes
    let ramSizeLower: SliderSizeType,
        ramSizeUpper: SliderSizeType,
        ssdNvmeSizeLower: SliderSizeType,
        ssdNvmeSizeUpper: SliderSizeType,
        ssdSataSizeLower: SliderSizeType,
        ssdSataSizeUpper: SliderSizeType,
        hddSizeLower: SliderSizeType,
        hddSizeUpper: SliderSizeType;

    $: if (filter) {
        ramSizeLower = getFormattedMemorySize(filter.ramInternalSize[0]);
        ramSizeUpper = getFormattedMemorySize(filter.ramInternalSize[1]);
        ssdNvmeSizeLower = getFormattedDiskSize(filter.ssdNvmeInternalSize[0]);
        ssdNvmeSizeUpper = getFormattedDiskSize(filter.ssdNvmeInternalSize[1]);
        ssdSataSizeLower = getFormattedDiskSize(filter.ssdSataInternalSize[0]);
        ssdSataSizeUpper = getFormattedDiskSize(filter.ssdSataInternalSize[1]);
        hddSizeLower = getFormattedDiskSize(filter.hddInternalSize[0], 500);
        hddSizeUpper = getFormattedDiskSize(filter.hddInternalSize[1], 500);
    }
</script>

{#if filter}
    <h1 class="text-xl py-2 font-semibold">Filter Settings</h1>
    <ul class="space-y-2 font-medium" data-testid="server-filter">
        <!-- Location Filters -->
        <li class="flex items-center justify-between">
            <h2 class="flex items-center">
                <FontAwesomeIcon class="w-4 h-4 me-1" icon={faGlobe} /> Location
            </h2>
        </li>
        <li>
            <Toggle bind:checked={filter.locationGermany}>Germany</Toggle>
        </li>
        <li>
            <Toggle bind:checked={filter.locationFinland}>Finland</Toggle>
        </li>

        <!-- Datacenter Filters -->
        <li>
            <h2>
                <FontAwesomeIcon
                    class="w-4 h-4 me-2"
                    icon={faBoxesStacked}
                />Datacenter
            </h2>
        </li>
        <li>
            <MultiSelect
                class="text-sm"
                items={datacenters}
                bind:value={filter.selectedDatacenters}
                size="sm"
            />
        </li>

        <!-- CPU Filters -->
        <li>
            <h2>
                <FontAwesomeIcon class="w-4 h-4 me-2" icon={faMicrochip} />CPU
            </h2>
        </li>
        <li><Label class="text-sm">Vendor</Label></li>
        <li>
            <Toggle bind:checked={filter.cpuIntel}>Intel</Toggle>
        </li>
        <li>
            <Toggle bind:checked={filter.cpuAMD}>AMD</Toggle>
        </li>
        <li><h2>Model</h2></li>
        <li>
            <MultiSelect
                class="text-sm"
                items={cpuModels}
                bind:value={filter.selectedCpuModels}
                size="sm"
            />
        </li>

        <!-- Memory Filters -->
        <li>
            <h2>
                <FontAwesomeIcon class="w-4 h-4 me-2" icon={faMemory} />Memory
            </h2>
        </li>
        <li class="flex justify-between">
            <Label class="text-sm">Size</Label>
            <span class="ml-2 text-right">
                {#if ramSizeLower === ramSizeUpper}
                    {ramSizeLower}
                {:else}
                    {ramSizeLower} – {ramSizeUpper}
                {/if}
            </span>
        </li>
        <li>
            <RangeSlider
                bind:values={filter.ramInternalSize}
                min={4}
                max={10}
                hoverable={false}
                {springValues}
                pips
                range
                pushy
                on:change={(e) => (filter!.ramInternalSize = e.detail.values)}
            />
        </li>
        <li>
            <div class="flex items-center justify-between">
                <Label class="text-sm">ECC</Label>
                <div>
                    <ButtonGroup class="flex">
                        <Button
                            size="xs"
                            on:click={() => (filter!.extrasECC = true)}
                            checked={filter.extrasECC === true}>yes</Button
                        >
                        <Button
                            size="xs"
                            on:click={() => (filter!.extrasECC = false)}
                            checked={filter.extrasECC === false}>no</Button
                        >
                        <Button
                            size="xs"
                            on:click={() => (filter!.extrasECC = null)}
                            checked={filter.extrasECC === null}>any</Button
                        >
                    </ButtonGroup>
                </div>
            </div>
        </li>

        <!-- Disk Filters -->
        <li>
            <h2>
                <FontAwesomeIcon class="w-4 h-4 me-2" icon={faHardDrive} />Disks
            </h2>
        </li>

        <!-- SSD (NVMe) Filters -->
        <li>
            <h3>SSDs (NVMe)</h3>
        </li>
        <li class="flex justify-between">
            <Label class="text-sm">Devices</Label>
            <span class="ml-2 text-right">
                {#if filter.ssdNvmeCount[0] === filter.ssdNvmeCount[1]}
                    {filter.ssdNvmeCount[0] === 0
                        ? "none"
                        : filter.ssdNvmeCount[0]}
                {:else}
                    {filter.ssdNvmeCount[0]} – {filter.ssdNvmeCount[1]}
                {/if}
            </span>
        </li>
        <li>
            <RangeSlider
                bind:values={filter.ssdNvmeCount}
                min={0}
                max={8}
                hoverable={false}
                {springValues}
                pips
                range
                pushy
                on:change={(e) => (filter!.ssdNvmeCount = e.detail.values)}
            />
        </li>
        <li class="flex justify-between">
            <Label class="text-sm">Size</Label>
            <span class="ml-2 text-right">
                {#if ssdNvmeSizeLower === ssdNvmeSizeUpper}
                    {ssdNvmeSizeLower}
                {:else}
                    {ssdNvmeSizeLower} – {ssdNvmeSizeUpper}
                {/if}
            </span>
        </li>
        <li>
            <RangeSlider
                bind:values={filter.ssdNvmeInternalSize}
                min={0}
                max={18}
                hoverable={false}
                {springValues}
                pips
                range
                pushy
                on:change={(e) =>
                    (filter!.ssdNvmeInternalSize = e.detail.values)}
            />
        </li>

        <!-- SSD (SATA) Filters -->
        <li>
            <h3>SSDs (SATA)</h3>
        </li>
        <li class="flex justify-between">
            <Label class="text-sm">Devices</Label>
            <span class="ml-2 text-right">
                {#if filter.ssdSataCount[0] === filter.ssdSataCount[1]}
                    {filter.ssdSataCount[0] === 0
                        ? "none"
                        : filter.ssdSataCount[0]}
                {:else}
                    {filter.ssdSataCount[0]} – {filter.ssdSataCount[1]}
                {/if}
            </span>
        </li>
        <li>
            <RangeSlider
                bind:values={filter.ssdSataCount}
                min={0}
                max={4}
                hoverable={false}
                {springValues}
                pips
                range
                pushy
                on:change={(e) => (filter!.ssdSataCount = e.detail.values)}
            />
        </li>
        <li class="flex justify-between">
            <Label class="text-sm">Size</Label>
            <span class="ml-2 text-right">
                {#if ssdSataSizeLower === ssdSataSizeUpper}
                    {ssdSataSizeLower}
                {:else}
                    {ssdSataSizeLower} – {ssdSataSizeUpper}
                {/if}
            </span>
        </li>
        <li>
            <RangeSlider
                bind:values={filter.ssdSataInternalSize}
                min={0}
                max={14}
                hoverable={false}
                {springValues}
                pips
                range
                pushy
                on:change={(e) =>
                    (filter!.ssdSataInternalSize = e.detail.values)}
            />
        </li>

        <!-- HDD Filters -->
        <li>
            <h3>HDDs</h3>
        </li>
        <li class="flex justify-between">
            <Label class="text-sm">Devices</Label>
            <span class="ml-2 text-right">
                {#if filter.hddCount[0] === filter.hddCount[1]}
                    {filter.hddCount[0] === 0 ? "none" : filter.hddCount[0]}
                {:else}
                    {filter.hddCount[0]} – {filter.hddCount[1]}
                {/if}
            </span>
        </li>
        <li>
            <RangeSlider
                bind:values={filter.hddCount}
                min={0}
                max={15}
                hoverable={false}
                {springValues}
                pips
                range
                pushy
                on:change={(e) => (filter!.hddCount = e.detail.values)}
            />
        </li>
        <li class="flex justify-between">
            <Label class="text-sm">HDD Size</Label>
            <span class="ml-2 text-right">
                {#if hddSizeLower === hddSizeUpper}
                    {hddSizeLower}
                {:else}
                    {hddSizeLower} – {hddSizeUpper}
                {/if}
            </span>
        </li>
        <li>
            <RangeSlider
                bind:values={filter.hddInternalSize}
                min={4}
                max={44}
                hoverable={false}
                {springValues}
                pips
                range
                pushy
                on:change={(e) => (filter!.hddInternalSize = e.detail.values)}
            />
        </li>

        <!-- Extras Filters -->
        <li>
            <h2>
                <FontAwesomeIcon class="w-4 h-4 me-2" icon={faTags} />Extras
            </h2>
        </li>
        <!-- Intel NIC -->
        <li>
            <div class="flex items-center justify-between">
                <Label class="text-sm">Intel NIC</Label>
                <div>
                    <ButtonGroup class="flex">
                        <Button
                            size="xs"
                            on:click={() => (filter!.extrasINIC = true)}
                            checked={filter.extrasINIC === true}>yes</Button
                        >
                        <Button
                            size="xs"
                            on:click={() => (filter!.extrasINIC = false)}
                            checked={filter.extrasINIC === false}>no</Button
                        >
                        <Button
                            size="xs"
                            on:click={() => (filter!.extrasINIC = null)}
                            checked={filter.extrasINIC === null}>any</Button
                        >
                    </ButtonGroup>
                </div>
            </div>
        </li>
        <!-- Hardware RAID -->
        <li>
            <div class="flex items-center justify-between">
                <Label class="text-sm">Hardware RAID</Label>
                <div>
                    <ButtonGroup class="flex">
                        <Button
                            size="xs"
                            on:click={() => (filter!.extrasHWR = true)}
                            checked={filter.extrasHWR === true}>yes</Button
                        >
                        <Button
                            size="xs"
                            on:click={() => (filter!.extrasHWR = false)}
                            checked={filter.extrasHWR === false}>no</Button
                        >
                        <Button
                            size="xs"
                            on:click={() => (filter!.extrasHWR = null)}
                            checked={filter.extrasHWR === null}>any</Button
                        >
                    </ButtonGroup>
                </div>
            </div>
        </li>
        <!-- GPU -->
        <li>
            <div class="flex items-center justify-between">
                <Label class="text-sm">GPU</Label>
                <div>
                    <ButtonGroup class="flex">
                        <Button
                            size="xs"
                            on:click={() => (filter!.extrasGPU = true)}
                            checked={filter.extrasGPU === true}>yes</Button
                        >
                        <Button
                            size="xs"
                            on:click={() => (filter!.extrasGPU = false)}
                            checked={filter.extrasGPU === false}>no</Button
                        >
                        <Button
                            size="xs"
                            on:click={() => (filter!.extrasGPU = null)}
                            checked={filter.extrasGPU === null}>any</Button
                        >
                    </ButtonGroup>
                </div>
            </div>
        </li>
        <!-- Redundant Power Supply -->
        <li>
            <div class="flex items-center justify-between">
                <Label class="text-sm">Redundant Power Supply</Label>
                <div>
                    <ButtonGroup class="flex">
                        <Button
                            size="xs"
                            on:click={() => (filter!.extrasRPS = true)}
                            checked={filter.extrasRPS === true}>yes</Button
                        >
                        <Button
                            size="xs"
                            on:click={() => (filter!.extrasRPS = false)}
                            checked={filter.extrasRPS === false}>no</Button
                        >
                        <Button
                            size="xs"
                            on:click={() => (filter!.extrasRPS = null)}
                            checked={filter.extrasRPS === null}>any</Button
                        >
                    </ButtonGroup>
                </div>
            </div>
        </li>
        <!-- Recently Seen -->
        <li>
            <div class="my-3">
                <Toggle bind:checked={filter.recentlySeen}>Recently Seen</Toggle
                >
            </div>
        </li>
    </ul>
{/if}

<style>
    :root {
        --tw-primary-600: theme("colors.primary.600");
        --tw-primary-400: theme("colors.primary.400");
    }

    :root {
        --range-handle: var(--tw-primary-600);
        --range-range: var(--tw-primary-600);
        --range-range-inactive: var(--tw-primary-400);
        --range-slider: rgb(237, 237, 237);
        --range-handle-inactive: var(--tw-primary-600);
        --range-handle-focus: var(--tw-primary-600);
    }
</style>
