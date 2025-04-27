<script lang="ts">
    import { vatOptions } from '$lib/components/VatSelector.svelte';
    import { enhance } from "$app/forms";
    import { invalidate, invalidateAll } from "$app/navigation";
    import { withDbConnections } from "$lib/api/frontend/dbapi";
    import {
        type ServerConfiguration,
        type ServerPriceStat,
        getConfigurations,
        getPrices,
    } from "$lib/api/frontend/filter";
    import type { PriceAlert } from '$lib/api/backend/alerts';
    import {
        type NameValuePair,
        getCPUModels,
        getDatacenters,
        getLastUpdated,
    } from "$lib/api/frontend/stats";
    import AlertModal from "$lib/components/AlertModal.svelte";
    import DbLoadingProgress from "$lib/components/DBLoadingProgress.svelte";
    import OutdatedDataAlert from "$lib/components/OutdatedDataAlert.svelte";
    import ServerFilter from "$lib/components/ServerFilter.svelte";
    import ServerList from "$lib/components/ServerList.svelte";
    import ServerPriceChart from "$lib/components/ServerPriceChart.svelte";
    import PriceControls from '$lib/components/PriceControls.svelte';
    import SortControls from '$lib/components/SortControls.svelte';
    import {
        type ServerFilter as ServerFilterType,
        clearFilter,
        isIdenticalFilter,
        loadFilter,
        saveFilter,
    } from "$lib/filter";
    import { filter } from "$lib/stores/filter";
    import { addToast } from "$lib/stores/toast";
    import { debounce } from "$lib/util";
    import { settingsStore } from '$lib/stores/settings';
    import { AsyncDuckDB } from "@duckdb/duckdb-wasm";
    import {
        faBell,
        faClockRotateLeft,
        faEuroSign,
        faFilter,
        faStopwatch,
        faWarning,
        faChevronLeft,
        faChevronRight,
    } from "@fortawesome/free-solid-svg-icons";
    import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
    import dayjs from "dayjs";
    import {
        Alert,
        Badge,
        Button,
        ButtonGroup,
        Input,
        Tooltip,
        InputAddon,
    } from "flowbite-svelte";
    import { InfoCircleSolid } from "flowbite-svelte-icons";
    import Spinner from "flowbite-svelte/Spinner.svelte";
    import { onMount } from "svelte";
    import { db, dbInitProgress } from "../../stores/db";

    type SortField = 'price' | 'ram' | 'storage';

    let { data } = $props<{ data: import('./$types').PageData }>();
    
    let lastUpdate = $state<number | undefined>(undefined);
    let serverList = $state<ServerConfiguration[]>([]);
    let filteredServerList = $state<ServerConfiguration[]>([]);
    let serverPrices = $state<ServerPriceStat[]>([]);
    let cpuModels = $state<NameValuePair[]>([]);
    let datacenters = $state<NameValuePair[]>([]);
    let priceMin: number | null = $state(null);
    let priceMax: number | null = $state(null);
    let sortField = $state<SortField>('price');
    let sortDirection = $state<'asc' | 'desc'>('asc');
    let queryTime = $state<number | undefined>(undefined);
    let loading = $state(true);
    let selectedAlert: PriceAlert | null = $state(null);
    let alertDialogOpen = $state(false);
    let storedFilter: ServerFilterType | null = $state(null);
    
    // State to hold the final list for display
    let displayList: ServerConfiguration[] = $state([]);
    let isFilterCollapsed = $state(false);

    function handleSaveFilter(e: Event) {
        saveFilter($filter);
        addToast({ message: "Filter saved.", color: "green", icon: "success" });
        storedFilter = $filter;
        e.preventDefault();
        e.stopPropagation();
    }

    function handleClearFilter(e: Event) {
        clearFilter();
        addToast({ message: "Filter cleared.", color: "green", icon: "success" });
        storedFilter = null;
        e.preventDefault();
        e.stopPropagation();
    }

    onMount(() => {
        storedFilter = loadFilter();
    });

    async function fetchData(dbInstance: AsyncDuckDB, currentFilter: ServerFilterType) {
        loading = true;
        console.log("Fetching data with filter:", currentFilter);
        let queryStart = performance.now();
        try {
            await withDbConnections(dbInstance, async (conn1, conn2, conn3, conn4) => {
                [cpuModels, datacenters, serverPrices, serverList] =
                    await Promise.all([
                        getCPUModels(conn1, currentFilter),
                        getDatacenters(conn2, currentFilter),
                        getPrices(conn3, currentFilter),
                        getConfigurations(conn4, currentFilter),
                    ]);
                queryTime = performance.now() - queryStart;
                console.log(`fetchData completed. serverList length: ${serverList.length}`);

                // Refresh last update timestamp
                if (!lastUpdate || dayjs().diff(lastUpdate, "minute") > 65) {
                    withDbConnections(dbInstance, async (conn1) => {
                        let last = await getLastUpdated(conn1);
                        if (last.length > 0) lastUpdate = last[0].last_updated;
                    });
                }
            });
        } catch (error: Error | any) {
            console.error("Error fetching data:", error);
            addToast({ message: 'Failed to fetch server data.', color: 'red', icon: 'error' });
        } finally {
            loading = false;
        }
    };

    const debouncedFetchData = debounce(fetchData, 500);

    // Effect to fetch data when db or filter changes
    $effect(() => {
        if ($db && $filter) {
            debouncedFetchData($db, $filter);
        }
    });

    // Effect to filter and sort the server list for display
    $effect(() => {
        console.log(`Filtering/Sorting Effect running. serverList: ${serverList.length}, priceMin: ${priceMin}, priceMax: ${priceMax}, sort: ${sortField} ${sortDirection}`);

        let list = serverList; // Start with the raw list

        // 1. Apply price filtering
        const countryCode = $settingsStore.vatSelection.countryCode as keyof typeof vatOptions;
        const selectedOption = countryCode in vatOptions ? vatOptions[countryCode] : vatOptions['NET'];
        const vatRate = selectedOption.rate;
        const minPriceBeforeVat = priceMin !== null ? Math.round((priceMin / (1 + vatRate)) * 100) / 100 : null;
        const maxPriceBeforeVat = priceMax !== null ? Math.round((priceMax / (1 + vatRate)) * 100) / 100 : null;

        if (minPriceBeforeVat !== null || maxPriceBeforeVat !== null) {
            list = list.filter(server => {
                const price = server.price ?? 0;
                const meetsMin = minPriceBeforeVat === null || price >= minPriceBeforeVat;
                const meetsMax = maxPriceBeforeVat === null || price <= maxPriceBeforeVat;
                return meetsMin && meetsMax;
            });
        }
        console.log(` -> After price filter: ${list.length} items`);

        // 2. Apply sorting (on a copy)
        const listToSort = [...list];
        listToSort.sort((a, b) => {
            let valA: number | string | null = null;
            let valB: number | string | null = null;

            switch (sortField) {
                case 'price':
                    valA = a.price ?? Infinity;
                    valB = b.price ?? Infinity;
                    break;
                case 'ram':
                    valA = a.ram_size ?? 0;
                    valB = b.ram_size ?? 0;
                    break;
                case 'storage':
                    const totalStorageA = (a.nvme_size ?? 0) + (a.sata_size ?? 0) + (a.hdd_size ?? 0);
                    const totalStorageB = (b.nvme_size ?? 0) + (b.sata_size ?? 0) + (b.hdd_size ?? 0);
                    valA = totalStorageA;
                    valB = totalStorageB;
                    break;
            }

            if (valA === null || valB === null) {
                if (valA === null && valB !== null) return sortDirection === 'asc' ? 1 : -1;
                if (valA !== null && valB === null) return sortDirection === 'asc' ? -1 : 1;
                return 0;
            }

            const comparison = valA < valB ? -1 : valA > valB ? 1 : 0;
            return sortDirection === 'asc' ? comparison : comparison * -1;
        });
        console.log(` -> After sorting: ${listToSort.length} items`);

        // Update the display list state
        displayList = listToSort;
    });


    // Derived state for total offers (can remain derived)
    let totalOffers = $derived(
        Array.isArray(serverPrices) ? serverPrices.reduce((acc, val) => acc + val.count, 0) : 0
    );

    // Derived state for UI flags (can remain derived)
    let hasFilter = $derived(storedFilter !== null);
    let updateStoredFilterDisabled = $derived(isIdenticalFilter($filter, storedFilter));

    // Ensure priceMin/Max are numbers when changed
    function handlePriceMinChange(event: Event) {
        const input = event.target as HTMLInputElement;
        priceMin = input.value === '' ? null : Number(input.value);
    }
    function handlePriceMaxChange(event: Event) {
        const input = event.target as HTMLInputElement;
        priceMax = input.value === '' ? null : Number(input.value);
    }
</script>

<div class="mx-auto max-w-[1680px]">
    <OutdatedDataAlert lastUpdate={lastUpdate ?? 0} />
    <AlertModal
        bind:open={alertDialogOpen}
        alert={selectedAlert}
        on:success={() => invalidateAll()}
    />
    {#if !Number.isNaN($dbInitProgress) && $dbInitProgress < 100}
        <DbLoadingProgress />
    {:else}
        <div
            class="grid grid-cols-1 sm:grid-cols-1 lg:grid-cols-[auto,1fr]
        md:border-r-2 md:border-r-gray-100"
        >
            <aside
                class="flex flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 transition-all duration-300 ease-in-out 
                    {isFilterCollapsed ? 'max-h-[6rem] sm:max-h-none sm:w-16 md:w-16' : 'sm:w-72 md:w-72'}"
            >
                <!-- ServerFilter Container - Grows and Scrolls -->
                <div class="flex-grow overflow-y-auto px-3 py-2">
                    <ServerFilter {datacenters} {cpuModels} bind:isFilterCollapsed />
                </div>
                <!-- Timestamp/Loading Info - Fixed at bottom -->
                {#if !isFilterCollapsed}
                <div class="px-3 py-2">
                    <!-- Content should always be visible -->
                    <div>
                        <hr class="mb-2" />
                        <div class="my-1">
                            {#if lastUpdate}
                            <p
                                    class="mt-2 text-center text-xs text-gray-400 dark:text-gray-400"
                                >
                                    <FontAwesomeIcon
                                        icon={faClockRotateLeft}
                                        class="me-1"
                                    />{dayjs
                                        .unix(lastUpdate)
                                        .format("DD.MM.YYYY HH:mm")}
                                </p>
                            {/if}
                            {#if queryTime}
                                <p
                                    class="mt-2 text-center text-xs text-gray-400 dark:text-gray-400"
                                >
                                    {#if loading}
                                        <span
                                            class="inline-block w-3 h-3 ml-1 border-2 border-gray-500 border-t-transparent border-solid rounded-full animate-spin"
                                            aria-hidden="true"
                                        ></span>
                                    {:else}
                                        <FontAwesomeIcon
                                            icon={faStopwatch}
                                            class="me-1"
                                        />completed in {queryTime.toFixed(0)}ms
                                    {/if}
                                </p>
                            {/if}
                        </div>
                    </div>
                </div>
                {/if}
            </aside>

            <main class="flex-grow overflow-y-auto bg-white">
                <div class="w-full">
                    <div
                        class="bg-white px-5 sm:border-t md:border-t-0 py-3 mb-3 grid grid-cols-1 md:grid-cols-2 gap-3 items-start text-left text-lg font-semibold text-gray-900 dark:bg-gray-800 dark:text-white border-b border-gray-200 dark:border-gray-700"
                    >
                        <!-- Left-aligned controls: scrollable on mobile with fixed fade -->
                        <div class="relative md:col-span-1 after:content-[''] after:absolute after:right-0 after:top-0 after:bottom-0 after:w-8 after:bg-gradient-to-l after:from-white after:to-transparent after:dark:from-gray-800 after:pointer-events-none md:after:hidden">
                            <div class="flex flex-nowrap gap-3 items-start overflow-x-auto scrollbar-hide text-xs text-gray-900">
                                <ButtonGroup class="flex-shrink-0">
                                    <InputAddon size="sm" class="bg-gray-50 text-gray-900">
                                        <FontAwesomeIcon
                                            icon={faEuroSign}
                                            class="me-2 dark:text-gray-400"
                                        />Price
                                    </InputAddon>
                                    <Input
                                        size="sm"
                                        type="number"
                                        min="0" step="1"
                                        placeholder="min"
                                        data-testid="price-min-input"
                                        class="text-xs w-12 bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        bind:value={priceMin}
                                        onchange={handlePriceMinChange}
                                    />
                                    <Input
                                        size="sm"
                                        type="number"
                                        min="0" step="1"
                                        placeholder="max"
                                        data-testid="price-max-input"
                                        class="text-xs w-12 bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        bind:value={priceMax}
                                        onchange={handlePriceMaxChange}
                                    />
                                </ButtonGroup>
                                <ButtonGroup class="flex-shrink-0">
                                    <InputAddon size="sm" class="bg-gray-50 text-gray-900">
                                        <FontAwesomeIcon
                                            class="me-2"
                                            icon={faFilter}
                                        />Filter
                                    </InputAddon>
                                    <Button
                                        size="xs"
                                        color="alternative"
                                        class="shadow-sm"
                                        data-testid="filter-save"
                                        disabled={updateStoredFilterDisabled}
                                        onclick={handleSaveFilter}
                                    >
                                        {#if hasFilter}
                                            Update
                                        {:else}
                                            Save
                                        {/if}
                                    </Button>
                                    {#if hasFilter}
                                        <Button
                                            size="xs"
                                            color="alternative"
                                            class="shadow-sm"
                                            data-testid="filter-clear"
                                            onclick={handleClearFilter}
                                            >Delete</Button
                                        >
                                    {/if}
                                </ButtonGroup>
                                <Tooltip
                                    placement="bottom"
                                    class="z-50 text-center"
                                >
                                    Store current filter locally<br />
                                    on your computer.
                                </Tooltip>

                                <ButtonGroup class="flex-shrink-0">
                                    <InputAddon size="sm" class="bg-gray-50 text-gray-900">
                                        <FontAwesomeIcon
                                            class="text-orange-500 me-2"
                                            icon={faBell}
                                        /> Alert
                                    </InputAddon>
                                    {#await data?.alert then alert}
                                        {#if alert}
                                            <Button
                                                color="alternative"
                                                size="xs"
                                                id="price-alert"
                                                onclick={(e: MouseEvent) => {
                                                    alertDialogOpen = true;
                                                    selectedAlert = alert;
                                                    e.stopPropagation();
                                                }}
                                            >
                                                Edit
                                            </Button>
                                            <form
                                                method="POST"
                                                action="/alerts?/delete"
                                                use:enhance={() => {
                                                    addToast({
                                                        color: "green",
                                                        message: "Alert deleted successfully.",
                                                        icon: "success",
                                                    });
                                                    selectedAlert = null;
                                                    invalidate("/analyze");
                                                }}
                                            >
                                                <input
                                                    type="hidden"
                                                    name="alertId"
                                                    value={alert.id}
                                                />
                                                <Button
                                                    color="alternative"
                                                    size="xs"
                                                    id="price-alert-delete"
                                                    type="submit"
                                                    onclick={(e: MouseEvent) => {
                                                        selectedAlert = null;
                                                        e.stopPropagation();
                                                    }}
                                                >
                                                    Delete
                                                </Button>
                                            </form>
                                        {:else}
                                            <Button
                                                color="alternative"
                                                size="xs"
                                                id="price-alert"
                                                onclick={(e: MouseEvent) => {
                                                    alertDialogOpen = true;
                                                    e.stopPropagation();
                                                }}
                                            >
                                                Create
                                            </Button>
                                            <Tooltip
                                                placement="bottom"
                                                class="z-50 text-center"
                                            >
                                                Get a notification once your<br />
                                                preferred price has been reached.
                                            </Tooltip>
                                        {/if}
                                    {/await}
                                </ButtonGroup>
                            </div>
                        </div>
                        
                        <div class="col-span-1 flex justify-end">
                            <PriceControls />
                        </div>
                    </div>
                    <h1
                        class="bg-white px-5 text-left text-xl font-semibold text-gray-900 dark:bg-gray-800 dark:text-white"
                    >
                        Price History
                    </h1>
                    <div class="border-b h-[320px]">
                        <ServerPriceChart
                            data={serverPrices}
                            {loading}
                            timeUnitPrice={$settingsStore.timeUnitPrice}
                        />
                    </div>
                </div>

                <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start mt-5 px-5 pb-5">
                    <!-- Group heading and badge -->
                    <div class="flex items-baseline gap-2">
                        <h3
                            class="bg-white text-left text-xl font-semibold text-gray-900 dark:bg-gray-800 dark:text-white"
                        >
                            Configurations
                        </h3>
                        {#if !loading}
                            <!-- Make badge slightly smaller -->
                            <Badge
                                color="green"
                                data-testid="results-count"
                                rounded
                                class="text-xs"
                                >{displayList.length > 100
                                    ? "100+"
                                    : displayList.length} results</Badge
                            >
                        {/if}
                    </div>
                    {#if !loading}
                        <!-- Sort controls: Stacked on mobile, right-aligned on larger screens -->
                        <div class="flex items-center gap-4 text-gray-500 text-sm mt-2 sm:mt-0">
                            <SortControls bind:sortField bind:sortDirection />
                        </div>
                    {/if}
                </div>
                {#if !loading && displayList.length > 100}
                    <Alert class="mx-5 mb-5" color="red">
                        <FontAwesomeIcon
                            icon={faWarning}
                            class="w-4 h-4 me-1"
                        />
                        We found more than 100 configurations and limited the results.
                        Please use the filter to narrow down the results.</Alert
                    >
                {/if}
                {#if loading}
                    <p
                        class="mt-1 text-sm font-normal text-gray-500 dark:text-gray-400
                ml-5"
                    >
                        <Spinner class="mr-2" /> Loading...
                    </p>
                {:else if displayList.length === 0}
                    <Alert class="mx-5"
                        ><InfoCircleSolid slot="icon" class="w-5 h-5" />No
                        servers matching the criteria were found. Try changing
                        some of the parameters.</Alert
                    >
                {:else}
                    <ServerList serverList={displayList} {loading} timeUnitPrice={$settingsStore.timeUnitPrice} />
                {/if}
            </main>
        </div>
    {/if}
</div>