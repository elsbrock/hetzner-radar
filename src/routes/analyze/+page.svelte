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
    import GroupControls from '$lib/components/GroupControls.svelte'; // Added import
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
    import { browser } from '$app/environment';
    
    type SortField = 'price' | 'ram' | 'storage';
    type GroupByField = 'none' | 'cpu_vendor' | 'cpu_model' | 'best_price'; // Updated type
    type GroupedServerList = Array<{ groupName: string; servers: ServerConfiguration[] }>;
   
    let { data } = $props<{ data: import('./$types').PageData }>();
    
    let lastUpdate = $state<number | undefined>(undefined);
    let serverList = $state<ServerConfiguration[]>([]);
    // let filteredServerList = $state<ServerConfiguration[]>([]); // No longer needed directly for display
    let serverPrices = $state<ServerPriceStat[]>([]);
    let cpuModels = $state<NameValuePair[]>([]);
    let datacenters = $state<NameValuePair[]>([]);
    let priceMin: number | null = $state(null);
    let priceMax: number | null = $state(null);
    let sortField = $state<SortField>('price');
    let sortDirection = $state<'asc' | 'desc'>('asc');
    let groupByField = $state<GroupByField>('none'); // Updated state type
    let queryTime = $state<number | undefined>(undefined);
    let loading = $state(true);
    let selectedAlert: PriceAlert | null = $state(null);
    let alertDialogOpen = $state(false);
    let storedFilter: ServerFilterType | null = $state(null);
    
    // State to hold the final grouped list for display
    // let displayList: ServerConfiguration[] = $state([]); // Replaced by groupedDisplayList
    let groupedDisplayList: GroupedServerList = $state([]); // Added state
    let isFilterCollapsed = $state(false);
    let mounted = $state(false); // State to track client-side mount

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

    onMount(() => {
        // Delay rendering of dynamic content until client has mounted
        // This helps prevent hydration mismatches for complex conditional UI
        mounted = true;
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
            console.log("Setting loading = false (before)"); // Added for debugging
            loading = false;
            console.log("Setting loading = false (after)"); // Added for debugging
        }
    };

    const debouncedFetchData = debounce(fetchData, 500);

    // Effect to fetch data when db or filter changes
    $effect(() => {
        if ($db && $filter) {
            debouncedFetchData($db, $filter);
        }
    });

    // --- Helper functions for grouping ---
    function calculateMedian(prices: number[]): number | null {
        if (prices.length === 0) return null;
        const sortedPrices = [...prices].sort((a, b) => a - b);
        const mid = Math.floor(sortedPrices.length / 2);
        return sortedPrices.length % 2 !== 0
            ? sortedPrices[mid]
            : (sortedPrices[mid - 1] + sortedPrices[mid]) / 2;
    }

    function calculatePercentile(prices: number[], percentile: number): number | null {
        if (prices.length === 0) return null;
        const sortedPrices = [...prices].sort((a, b) => a - b);
        const index = (percentile / 100) * (sortedPrices.length - 1); // N-1 adjustment
        if (Number.isInteger(index)) {
            return sortedPrices[index];
        } else {
            const lowerIndex = Math.floor(index);
            const upperIndex = Math.ceil(index);
            // Handle edge case where upperIndex might be out of bounds if index is very close to length-1
            if (upperIndex >= sortedPrices.length) return sortedPrices[lowerIndex];
            // Linear interpolation
            return sortedPrices[lowerIndex] + (index - lowerIndex) * (sortedPrices[upperIndex] - sortedPrices[lowerIndex]);
        }
    }
    // --- End Helper functions ---

    // Effect to filter, sort, and group the server list for display
    $effect(() => {
        console.log(`Filtering/Sorting/Grouping Effect running. serverList: ${serverList.length}, priceMin: ${priceMin}, priceMax: ${priceMax}, sort: ${sortField} ${sortDirection}, group: ${groupByField}`);

        let list = serverList; // Start with the raw list

        // 1. Apply price filtering
        const countryCode = $settingsStore.vatSelection.countryCode as keyof typeof vatOptions;
        const selectedOption = countryCode in vatOptions ? vatOptions[countryCode] : vatOptions['NET'];
        const vatRate = selectedOption.rate;
        const minPriceBeforeVat = priceMin !== null ? Math.round((priceMin / (1 + vatRate)) * 100) / 100 : null;
        const maxPriceBeforeVat = priceMax !== null ? Math.round((priceMax / (1 + vatRate)) * 100) / 100 : null;

        if (minPriceBeforeVat !== null || maxPriceBeforeVat !== null) {
            list = list.filter(server => {
                const price = server.price ?? null; // Treat missing price as null
                if (price === null) return false; // Exclude servers without price from price range filtering
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
                    valA = a.price ?? Infinity; // Null prices sort last when ascending
                    valB = b.price ?? Infinity;
                    break;
                case 'ram':
                    valA = a.ram_size ?? 0; // Null RAM sort first when ascending
                    valB = b.ram_size ?? 0;
                    break;
                case 'storage':
                    const totalStorageA = (a.nvme_size ?? 0) + (a.sata_size ?? 0) + (a.hdd_size ?? 0);
                    const totalStorageB = (b.nvme_size ?? 0) + (b.sata_size ?? 0) + (b.hdd_size ?? 0);
                    valA = totalStorageA;
                    valB = totalStorageB;
                    break;
            }

            // Handle nulls consistently based on sort direction
            if (valA === Infinity && valB !== Infinity) return sortDirection === 'asc' ? 1 : -1;
            if (valA !== Infinity && valB === Infinity) return sortDirection === 'asc' ? -1 : 1;
            if (valA === 0 && valB !== 0 && (sortField === 'ram' || sortField === 'storage')) return sortDirection === 'asc' ? -1 : 1;
            if (valA !== 0 && valB === 0 && (sortField === 'ram' || sortField === 'storage')) return sortDirection === 'asc' ? 1 : -1;
            if (valA === valB) return 0; // Includes null == null or Infinity == Infinity

            const comparison = (valA as number) < (valB as number) ? -1 : 1;
            return sortDirection === 'asc' ? comparison : comparison * -1;
        });
        console.log(` -> After sorting: ${listToSort.length} items`);

        // 3. Apply grouping
        let groupedResult: GroupedServerList = [];
        // Use a Map where the value holds the group name and the server list
        const groups = new Map<string, { groupName: string; servers: ServerConfiguration[] }>();
        const unknownVendorKey = '__unknown_vendor__';
        const unknownModelKey = '__unknown_model__';
        const unknownVendorName = 'Unknown Vendor';
        const unknownModelName = 'Unknown Model';

        switch (groupByField) {
            case 'none':
                // For 'none', we don't use the Map structure, just assign directly
                groupedResult = [{ groupName: 'All Servers', servers: listToSort }];
                break;

            case 'cpu_vendor':
                listToSort.forEach(server => {
                    let key: string;
                    let name: string;
                    // Derive vendor from cpu string, handle null/undefined cpu
                    if (server.cpu) {
                        const vendor = server.cpu.split(' ')[0];
                        // Basic check for known vendors
                        if (vendor === 'Intel' || vendor === 'AMD') {
                            key = vendor;
                            name = vendor;
                        } else {
                            // Treat others as unknown
                            key = unknownVendorKey;
                            name = unknownVendorName;
                        }
                    } else {
                        // Handle null/undefined server.cpu
                        key = unknownVendorKey;
                        name = unknownVendorName;
                    }

                    if (!groups.has(key)) {
                        groups.set(key, { groupName: name, servers: [] });
                    }
                    // Push server to the 'servers' array within the map value
                    groups.get(key)!.servers.push(server);
                });
                // Convert map values to the final array structure
                groupedResult = Array.from(groups.values());
                // Sort groups by name, placing Unknown last
                groupedResult.sort((a, b) => {
                    if (a.groupName === unknownVendorName) return 1;
                    if (b.groupName === unknownVendorName) return -1;
                    return a.groupName.localeCompare(b.groupName);
                });
                break;

            case 'cpu_model':
                 listToSort.forEach(server => {
                    // Use cpu string as key, handle null/undefined cpu
                    const key = server.cpu ?? unknownModelKey;
                    const name = server.cpu ?? unknownModelName; // User-friendly name

                    if (!groups.has(key)) {
                        groups.set(key, { groupName: name, servers: [] });
                    }
                    // Push server to the 'servers' array within the map value
                    groups.get(key)!.servers.push(server);
                });
                 // Convert map values to the final array structure
                groupedResult = Array.from(groups.values());
                 // Sort groups by name, placing Unknown last
                 groupedResult.sort((a, b) => {
                    if (a.groupName === unknownModelName) return 1;
                    if (b.groupName === unknownModelName) return -1;
                    return a.groupName.localeCompare(b.groupName);
                });
                break;

            case 'best_price':
            	const bestPriceGroupName = 'Best Price';
            	const aboveBestPriceGroupName = 'Above Best Price';
            	const epsilon = 0.001; // Tolerance for float comparison
         
            	// Initialize final groups
            	groups.set(bestPriceGroupName, { groupName: bestPriceGroupName, servers: [] });
            	groups.set(aboveBestPriceGroupName, { groupName: aboveBestPriceGroupName, servers: [] });
         
            	// Assign servers based on pre-calculated markup_percentage
            	listToSort.forEach(server => {
            		// Check if markup_percentage is effectively zero (within epsilon)
            		if (server.markup_percentage !== null && Math.abs(server.markup_percentage) < epsilon) {
            			groups.get(bestPriceGroupName)!.servers.push(server);
            		} else {
            			// Includes servers with markup > 0 or null markup_percentage
            			groups.get(aboveBestPriceGroupName)!.servers.push(server);
            		}
            	});
         
            	// Convert map values to array, filtering empty groups
            	groupedResult = Array.from(groups.values())
            		.filter(groupData => groupData.servers.length > 0);
         
            	// Sort groups: Best Price first
            	groupedResult.sort((a, b) => {
            		if (a.groupName === bestPriceGroupName) return -1;
            		if (b.groupName === bestPriceGroupName) return 1;
            		return 0;
            	});
            	break;
           }
           console.log(` -> After grouping (${groupByField}): ${groupedResult.reduce((sum, g) => sum + g.servers.length, 0)} items in ${groupedResult.length} groups`);
         
           // Update the grouped display list state
        groupedDisplayList = groupedResult;
    });

    // Derived state for total offers (can remain derived)
    let totalOffers = $derived(
        Array.isArray(serverPrices) ? serverPrices.reduce((acc, val) => acc + val.count, 0) : 0
    );

    // Derived state for total results count from grouped list
    let totalResults = $derived(
        groupedDisplayList.reduce((sum, group) => sum + group.servers.length, 0)
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
        md:border-r-2 md:border-r-gray-100 dark:border-r-gray-700"
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
                        <hr class="mb-2 border-gray-200 dark:border-gray-700" />
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

            <main class="flex-grow overflow-y-auto bg-white dark:bg-gray-900">
                <div class="w-full">
                    <div
                        class="bg-white px-5 sm:border-t md:border-t-0 py-3 mb-3 grid grid-cols-1 md:grid-cols-2 gap-3 items-start text-left text-lg font-semibold text-gray-900 dark:bg-gray-800 dark:text-white border-b border-gray-200 dark:border-gray-700"
                    >
                        <!-- Left-aligned controls: scrollable on mobile with fixed fade -->
                        <div class="relative md:col-span-1 after:content-[''] after:absolute after:right-0 after:top-0 after:bottom-0 after:w-8 after:bg-gradient-to-l after:from-white after:to-transparent after:dark:from-gray-800 after:pointer-events-none md:after:hidden">
                            <div class="flex flex-nowrap gap-3 items-start overflow-x-auto scrollbar-hide text-xs text-gray-900 dark:text-gray-300">
                                <ButtonGroup class="flex-shrink-0">
                                    <InputAddon size="sm" class="bg-gray-50 text-gray-900 dark:bg-gray-700 dark:text-gray-300">
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
                                        class="text-xs w-12 bg-white dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        bind:value={priceMin}
                                        onchange={handlePriceMinChange}
                                    />
                                    <Input
                                        size="sm"
                                        type="number"
                                        min="0" step="1"
                                        placeholder="max"
                                        data-testid="price-max-input"
                                        class="text-xs w-12 bg-white dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        bind:value={priceMax}
                                        onchange={handlePriceMaxChange}
                                    />
                                </ButtonGroup>
                                <ButtonGroup class="flex-shrink-0">
                                    <InputAddon size="sm" class="bg-gray-50 text-gray-900 dark:bg-gray-700 dark:text-gray-300">
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
                                    <InputAddon size="sm" class="bg-gray-50 text-gray-900 dark:bg-gray-700 dark:text-gray-300">
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
                        class="px-5 text-left text-xl font-semibold text-gray-900 dark:text-white"
                    >
                        Price History
                    </h1>
                    <div class="border-b border-gray-200 dark:border-gray-700 h-[320px]">
                        <ServerPriceChart
                            data={serverPrices}
                            {loading}
                            timeUnitPrice={$settingsStore.timeUnitPrice}
                        />
                    </div>
                </div>

                {#if browser && mounted}
                <!-- Defer rendering this section until client-side mount to avoid hydration issues -->
                <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start mt-5 px-5">
                    <!-- Group heading and badge -->
                    <div class="flex items-baseline">
                        <h3
                            class="text-left text-xl font-semibold text-gray-900 dark:text-white me-2"
                        >
                            Configurations
                        </h3>
                        {#if !loading}
                            <!-- Use the derived totalResults state -->
                            <Badge
                                color="green"
                                data-testid="results-count"
                                rounded
                                class="text-xs"
                                >{totalResults > 100
                                    ? "100+"
                                    : totalResults} results</Badge
                            >
                        {/if}
                    </div>
                    {#if !loading}
                        <!-- Sort & Group controls: Stacked on mobile, right-aligned on larger screens -->
                        <div class="flex flex-wrap items-center justify-start sm:justify-end gap-x-4 gap-y-2 text-gray-500 dark:text-gray-400 text-sm mt-2 sm:mt-0">
                            <GroupControls bind:groupByField />
                            <SortControls bind:sortField bind:sortDirection />
                        </div>
                    {/if}
                </div>
                {#if !loading && totalResults > 100}
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
                    <!-- Loading Spinner -->
                    <p class="mt-1 text-sm font-normal text-gray-500 dark:text-gray-400 ml-5">
                        <Spinner class="mr-2" /> Loading...
                    </p>
                {:else}
                    <!-- Content to show when NOT loading -->
                    {#if totalResults > 0}
                        <!-- Show >100 Alert if needed -->
                        {#if totalResults > 100}
                            <Alert class="mx-5 mb-5" color="red">
                                <FontAwesomeIcon icon={faWarning} class="w-4 h-4 me-1" />
                                We found more than 100 configurations and limited the results. Please use the filter to narrow down the results.
                            </Alert>
                        {/if}

                        <!-- Show Server List -->
                        <ServerList groupedList={groupedDisplayList} {groupByField} timeUnitPrice={$settingsStore.timeUnitPrice} />
                    {:else}
                        <!-- Show No Results Alert -->
                        <Alert class="mx-5">
                            <InfoCircleSolid slot="icon" class="w-5 h-5" />
                            No servers matching the criteria were found. Try changing some of the parameters.
                        </Alert>
                    {/if}
                {/if}
                {/if} <!-- End of browser && mounted block -->
            </main>
        </div>
    {/if}
</div>