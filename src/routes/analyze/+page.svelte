<script lang="ts">
  import { enhance } from "$app/forms";
  import { invalidate, invalidateAll } from "$app/navigation";
  import type { PriceAlert } from "$lib/api/backend/alerts";
  import { withDbConnections } from "$lib/api/frontend/dbapi";
  import {
    type ServerConfiguration,
    type ServerPriceStat,
    getConfigurations,
    getPrices,
  } from "$lib/api/frontend/filter";
  import {
    type NameValuePair,
    getCPUModels,
    getDatacenters,
    getLastUpdated,
    getPopularityStats,
  } from "$lib/api/frontend/stats";
  import AlertModal from "$lib/components/AlertModal.svelte";
  import DbLoadingProgress from "$lib/components/DBLoadingProgress.svelte";
  import FloatingActionButton from "$lib/components/FloatingActionButton.svelte";
  import GroupControls from "$lib/components/GroupControls.svelte";
  import OutdatedDataAlert from "$lib/components/OutdatedDataAlert.svelte";
  import PriceControls from "$lib/components/PriceControls.svelte";
  import QuickStat from "$lib/components/QuickStat.svelte";
  import ServerFilter from "$lib/components/ServerFilter.svelte";
  import ServerList from "$lib/components/ServerList.svelte";
  import ServerPriceChart from "$lib/components/ServerPriceChart.svelte";
  import SortControls from "$lib/components/SortControls.svelte";
  import { vatOptions } from "$lib/components/VatSelector.svelte";
  // FAB component
  import {
    type ServerFilter as ServerFilterType,
    clearFilter,
    isIdenticalFilter,
    loadFilter,
    saveFilter,
  } from "$lib/filter";
  import { filter } from "$lib/stores/filter";
  import { settingsStore } from "$lib/stores/settings";
  import { addToast } from "$lib/stores/toast";
  import { debounce } from "$lib/util";
  import { AsyncDuckDB } from "@duckdb/duckdb-wasm";
  import {
    faArrowDown, // FAB icon
    faArrowUp,
    faBell,
    faClockRotateLeft,
    faEuroSign,
    faFilter,
    faStopwatch,
    faWarning,
  } from "@fortawesome/free-solid-svg-icons";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import dayjs from "dayjs";
  import {
    Alert,
    Button,
    ButtonGroup,
    Input,
    InputAddon,
    Tooltip,
  } from "flowbite-svelte";
  import { InfoCircleSolid } from "flowbite-svelte-icons";
  import Spinner from "flowbite-svelte/Spinner.svelte";
  import { onMount } from "svelte";
  import { slide } from "svelte/transition";
  // Import slide transition
  import { browser } from "$app/environment";
  import { db, dbInitProgress } from "../../stores/db";

  type SortField = "price" | "ram" | "storage";
  type GroupByField = "none" | "cpu_vendor" | "cpu_model" | "best_price"; // Updated type
  type GroupedServerList = Array<{
    groupName: string;
    servers: ServerConfiguration[];
  }>;

  let { data } = $props<{ data: import("./$types").PageData }>();

  let lastUpdate = $state<number | undefined>(undefined);
  let serverList = $state<ServerConfiguration[]>([]);
  // let filteredServerList = $state<ServerConfiguration[]>([]); // No longer needed directly for display
  let serverPrices = $state<ServerPriceStat[]>([]);
  let cpuModels = $state<NameValuePair[]>([]);
  let datacenters = $state<NameValuePair[]>([]);
  let priceMin: number | null = $state(null);
  let priceMax: number | null = $state(null);
  let sortField = $state<SortField>("price");
  let sortDirection = $state<"asc" | "desc">("asc");
  let groupByField = $state<GroupByField>("none"); // Updated state type
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

  // FAB Visibility State
  let filterIsIntersecting = $state(true);  // Start with filter section visible
  let resultsAreIntersecting = $state(false);
  let isSmallScreen = $state(false); // Track if viewport is small (e.g., <= 1024px)
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

  // Effect for setting up Intersection Observers and screen size checks (client-side only)
  $effect(() => {
    if (!browser) return; // Ensure this runs only in the browser

    // Delay rendering of dynamic content until client has mounted
    // This helps prevent hydration mismatches for complex conditional UI
    mounted = true;

    // Media Query for small screens
    const mediaQuery = window.matchMedia("(max-width: 1024px)"); // lg breakpoint
    const updateScreenSize = () => {
      isSmallScreen = mediaQuery.matches;
      console.log("isSmallScreen:", isSmallScreen);
      
      // If screen size changes, we need to re-evaluate visibility immediately
      // This ensures FAB state is correct before observers fire
      if (isSmallScreen) {
        // On small screens, assume filter is visible initially (top of page)
        filterIsIntersecting = true;
        resultsAreIntersecting = false;
      } else {
        // On larger screens, reset the state
        filterIsIntersecting = false;
        resultsAreIntersecting = false;
      }
    };
    updateScreenSize(); // Initial check
    mediaQuery.addEventListener("change", updateScreenSize);

    // Intersection Observers
    const filterSection = document.getElementById("filter-section");
    const resultsSection = document.getElementById("results-section");
    let filterObserver: IntersectionObserver | null = null;
    let resultsObserver: IntersectionObserver | null = null;

    const observerOptions = {
      root: null, // Use the viewport as the root
      rootMargin: "0px",
      threshold: 0.1, // Trigger when 10% is visible
    };

    const setupObservers = () => {
      // Disconnect previous observers if they exist
      filterObserver?.disconnect();
      resultsObserver?.disconnect();

      if (isSmallScreen && filterSection && resultsSection) {
        console.log("Setting up observers for small screen");
        filterObserver = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            filterIsIntersecting = entry.isIntersecting;
            console.log("Filter intersecting:", filterIsIntersecting);
          });
        }, observerOptions);
        filterObserver.observe(filterSection);

        resultsObserver = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            resultsAreIntersecting = entry.isIntersecting;
            console.log("Results intersecting:", resultsAreIntersecting);
          });
        }, observerOptions);
        resultsObserver.observe(resultsSection);
      } else {
        console.log(
          "Disconnecting observers (not small screen or elements missing)"
        );
        // On larger screens, reset the state
        filterIsIntersecting = false;
        resultsAreIntersecting = false;
      }
    };

    setupObservers(); // Initial setup based on current screen size

    // Cleanup function
    return () => {
      console.log("Cleaning up observers and listeners");
      mediaQuery.removeEventListener("change", updateScreenSize);
      filterObserver?.disconnect();
      resultsObserver?.disconnect();
    };
  });

  async function fetchData(
    dbInstance: AsyncDuckDB,
    currentFilter: ServerFilterType
  ) {
    loading = true;
    console.log("Fetching data with filter:", currentFilter);
    let queryStart = performance.now();
    try {
      await withDbConnections(
        dbInstance,
        async (conn1, conn2, conn3, conn4, conn5) => {
          const [cpuModelsResult, datacentersResult, serverPricesResult, serverListResult, popularityResult] =
            await Promise.all([
              getCPUModels(conn1, currentFilter),
              getDatacenters(conn2, currentFilter),
              getPrices(conn3, currentFilter),
              getConfigurations(conn4, currentFilter),
              getPopularityStats(conn5, currentFilter),
            ]);
            
          cpuModels = cpuModelsResult;
          datacenters = datacentersResult;
          serverPrices = serverPricesResult;
          serverList = serverListResult;
          
          // Update popularity value and convert it to a qualitative label
          popularityValue = popularityResult;
          if (popularityValue !== null) {
            // Convert ratio to label based on thresholds
            if (popularityValue > 1.2) {
              popularityFormatted = "High";
            } else if (popularityValue >= 0.8) {
              popularityFormatted = "Normal";
            } else {
              popularityFormatted = "Low";
            }
          } else {
            popularityFormatted = "Normal";
          }
          queryTime = performance.now() - queryStart;
          console.log(
            `fetchData completed. serverList length: ${serverList.length}`
          );

          // Refresh last update timestamp
          if (!lastUpdate || dayjs().diff(lastUpdate, "minute") > 65) {
            withDbConnections(dbInstance, async (conn1) => {
              let last = await getLastUpdated(conn1);
              if (last.length > 0) lastUpdate = last[0].last_updated;
            });
          }
        }
      );
    } catch (error: Error | any) {
      console.error("Error fetching data:", error);
      addToast({
        message: "Failed to fetch server data.",
        color: "red",
        icon: "error",
      });
    } finally {
      console.log("Setting loading = false (before)"); // Added for debugging
      loading = false;
      console.log("Setting loading = false (after)"); // Added for debugging
    }
  }

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

  function calculatePercentile(
    prices: number[],
    percentile: number
  ): number | null {
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
      return (
        sortedPrices[lowerIndex] +
        (index - lowerIndex) *
          (sortedPrices[upperIndex] - sortedPrices[lowerIndex])
      );
    }
  }
  // --- End Helper functions ---

  // Effect to filter, sort, and group the server list for display
  $effect(() => {
    console.log(
      `Filtering/Sorting/Grouping Effect running. serverList: ${serverList.length}, priceMin: ${priceMin}, priceMax: ${priceMax}, sort: ${sortField} ${sortDirection}, group: ${groupByField}`
    );

    let list = serverList; // Start with the raw list

    // 1. Apply price filtering
    const countryCode =
      ($settingsStore?.vatSelection?.countryCode as keyof typeof vatOptions) ??
      "NET"; // Default to NET if undefined
    const selectedOption =
      countryCode in vatOptions ? vatOptions[countryCode] : vatOptions["NET"];
    const vatRate = selectedOption.rate;
    const minPriceBeforeVat =
      priceMin !== null
        ? Math.round((priceMin / (1 + vatRate)) * 100) / 100
        : null;
    const maxPriceBeforeVat =
      priceMax !== null
        ? Math.round((priceMax / (1 + vatRate)) * 100) / 100
        : null;

    if (minPriceBeforeVat !== null || maxPriceBeforeVat !== null) {
      list = list.filter((server) => {
        const price = server.price ?? null; // Treat missing price as null
        if (price === null) return false; // Exclude servers without price from price range filtering
        const meetsMin =
          minPriceBeforeVat === null || price >= minPriceBeforeVat;
        const meetsMax =
          maxPriceBeforeVat === null || price <= maxPriceBeforeVat;
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
        case "price":
          valA = a.price ?? Infinity; // Null prices sort last when ascending
          valB = b.price ?? Infinity;
          break;
        case "ram":
          valA = a.ram_size ?? 0; // Null RAM sort first when ascending
          valB = b.ram_size ?? 0;
          break;
        case "storage":
          const totalStorageA =
            (a.nvme_size ?? 0) + (a.sata_size ?? 0) + (a.hdd_size ?? 0);
          const totalStorageB =
            (b.nvme_size ?? 0) + (b.sata_size ?? 0) + (b.hdd_size ?? 0);
          valA = totalStorageA;
          valB = totalStorageB;
          break;
      }

      // Handle nulls consistently based on sort direction
      if (valA === Infinity && valB !== Infinity)
        return sortDirection === "asc" ? 1 : -1;
      if (valA !== Infinity && valB === Infinity)
        return sortDirection === "asc" ? -1 : 1;
      if (
        valA === 0 &&
        valB !== 0 &&
        (sortField === "ram" || sortField === "storage")
      )
        return sortDirection === "asc" ? -1 : 1;
      if (
        valA !== 0 &&
        valB === 0 &&
        (sortField === "ram" || sortField === "storage")
      )
        return sortDirection === "asc" ? 1 : -1;
      if (valA === valB) return 0; // Includes null == null or Infinity == Infinity

      const comparison = (valA as number) < (valB as number) ? -1 : 1;
      return sortDirection === "asc" ? comparison : comparison * -1;
    });
    console.log(` -> After sorting: ${listToSort.length} items`);

    // 3. Apply grouping
    let groupedResult: GroupedServerList = [];
    // Use a Map where the value holds the group name and the server list
    const groups = new Map<
      string,
      { groupName: string; servers: ServerConfiguration[] }
    >();
    const unknownVendorKey = "__unknown_vendor__";
    const unknownModelKey = "__unknown_model__";
    const unknownVendorName = "Unknown Vendor";
    const unknownModelName = "Unknown Model";

    switch (groupByField) {
      case "none":
        // For 'none', we don't use the Map structure, just assign directly
        groupedResult = [{ groupName: "All Servers", servers: listToSort }];
        break;

      case "cpu_vendor":
        listToSort.forEach((server) => {
          let key: string;
          let name: string;
          // Derive vendor from cpu string, handle null/undefined cpu
          if (server.cpu) {
            const vendor = server.cpu.split(" ")[0];
            // Basic check for known vendors
            if (vendor === "Intel" || vendor === "AMD") {
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

      case "cpu_model":
        listToSort.forEach((server) => {
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

      case "best_price":
        const bestPriceGroupName = "Best Price";
        const aboveBestPriceGroupName = "Above Best Price";
        const epsilon = 0.001; // Tolerance for float comparison

        // Initialize final groups
        groups.set(bestPriceGroupName, {
          groupName: bestPriceGroupName,
          servers: [],
        });
        groups.set(aboveBestPriceGroupName, {
          groupName: aboveBestPriceGroupName,
          servers: [],
        });

        // Assign servers based on pre-calculated markup_percentage
        listToSort.forEach((server) => {
          // Check if markup_percentage is effectively zero (within epsilon)
          if (
            server.markup_percentage !== null &&
            Math.abs(server.markup_percentage) < epsilon
          ) {
            groups.get(bestPriceGroupName)!.servers.push(server);
          } else {
            // Includes servers with markup > 0 or null markup_percentage
            groups.get(aboveBestPriceGroupName)!.servers.push(server);
          }
        });

        // Convert map values to array, filtering empty groups
        groupedResult = Array.from(groups.values()).filter(
          (groupData) => groupData.servers.length > 0
        );

        // Sort groups: Best Price first
        groupedResult.sort((a, b) => {
          if (a.groupName === bestPriceGroupName) return -1;
          if (b.groupName === bestPriceGroupName) return 1;
          return 0;
        });
        break;
    }
    console.log(
      ` -> After grouping (${groupByField}): ${groupedResult.reduce((sum, g) => sum + g.servers.length, 0)} items in ${groupedResult.length} groups`
    );

    // Update the grouped display list state
    groupedDisplayList = groupedResult;
  });

  // Derived state for total offers (can remain derived)
  let totalOffers = $derived(
    Array.isArray(serverPrices)
      ? serverPrices.reduce((acc, val) => acc + val.count, 0)
      : 0
  );

  // Derived state for available auctions (from last data point)
  let availableAuctions = $derived(
    Array.isArray(serverPrices) && serverPrices.length > 0
      ? (serverPrices[serverPrices.length - 1]?.count ?? 0)
      : 0
  );

  // Derived state for total results count from grouped list
  let totalResults = $derived(
    groupedDisplayList.reduce((sum, group) => sum + group.servers.length, 0)
  );

  // Non-derived variables for QuickStats
  let totalResultsValue = $state(0);
  let lowestPriceValue = $state<number | null>(null);
  let averagePriceValue = $state<number | null>(null);
  let priceRangeValue = $state<number | null>(null);
  let availableAuctionsValue = $state(0);
  let popularityValue = $state<number | null>(1); // Default to 1 (neutral)
  let lowestPriceFormatted = $state("N/A");
  let averagePriceFormatted = $state("N/A");
  let priceRangeFormatted = $state("N/A");
  let popularityFormatted = $state("Normal");

  // Derived state for UI flags (can remain derived)
  let hasFilter = $derived(storedFilter !== null);
  let updateStoredFilterDisabled = $derived(
    isIdenticalFilter($filter, storedFilter)
  );

  // Helper function to get filtered prices
  function getFilteredPrices(): number[] {
    return groupedDisplayList
      .flatMap((group) => group.servers)
      .map((server) => server.price)
      .filter((price) => price !== null && price !== undefined) as number[];
  }

  // Derived state for QuickStats
  let lowestPrice = $derived(() => {
    const prices = getFilteredPrices();
    return prices.length > 0 ? Math.min(...prices) : null;
  });

  let highestPrice = $derived(() => {
    const prices = getFilteredPrices();
    return prices.length > 0 ? Math.max(...prices) : null;
  });

  // Format price with VAT and timeUnitPrice for display
  function formatPrice(price: number | null): string {
    if (price === null || Number.isNaN(price) || !Number.isFinite(price))
      return "N/A";
  
    const countryCode =
      ($settingsStore?.vatSelection?.countryCode as keyof typeof vatOptions) ??
      "NET";
    const selectedOption =
      countryCode in vatOptions ? vatOptions[countryCode] : vatOptions["NET"];
    const vatRate = selectedOption.rate || 0; // Ensure rate is a number
    const timeUnit = $settingsStore.timeUnitPrice || "perMonth";
  
    // Apply VAT
    const priceWithVat = price * (1 + vatRate);
    
    if (!Number.isFinite(priceWithVat)) return "N/A";
    
    // Format based on time unit
    if (timeUnit === "perHour") {
      // Convert monthly price to hourly (divide by hours in a month)
      const hourlyPrice = priceWithVat / (30 * 24);
      return `${hourlyPrice.toFixed(4)} €/h`;
    } else {
      // Monthly price
      return `${priceWithVat.toFixed(2)} €/mo`;
    }
  }

  // Effect to update non-derived variables for QuickStats
  $effect(() => {
    // Calculate the actual values from derived state
    const totalResultsVal = groupedDisplayList.reduce(
      (sum, group) => sum + group.servers.length,
      0
    );
    const lowestPriceVal = (() => {
      const prices = getFilteredPrices();
      return prices.length > 0 ? Math.min(...prices) : null;
    })();
    const averagePriceVal = (() => {
      const prices = getFilteredPrices();
      if (prices.length === 0) return null;
      const sum = prices.reduce((acc, price) => acc + price, 0);
      return prices.length > 0 ? sum / prices.length : null;
    })();
    const priceRangeVal = (() => {
      const prices = getFilteredPrices();
      if (prices.length === 0) return null;
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      if (Number.isNaN(min) || Number.isNaN(max)) return null;
      const range = max - min;
      return Number.isFinite(range) ? range : null;
    })();
    const availableAuctionsVal =
      Array.isArray(serverPrices) && serverPrices.length > 0
        ? (serverPrices[serverPrices.length - 1]?.count ?? 0)
        : 0;

    // Update total results
    totalResultsValue = totalResultsVal;

    // Update available auctions
    availableAuctionsValue = availableAuctionsVal;

    // Update price statistics
    if (lowestPriceVal !== null && Number.isFinite(lowestPriceVal)) {
      lowestPriceValue = lowestPriceVal;
      lowestPriceFormatted = formatPrice(lowestPriceVal);
    } else {
      lowestPriceFormatted = "N/A";
    }

    if (averagePriceVal !== null && Number.isFinite(averagePriceVal)) {
      averagePriceValue = averagePriceVal;
      averagePriceFormatted = formatPrice(averagePriceVal);
    } else {
      averagePriceFormatted = "N/A";
    }

    if (priceRangeVal !== null && Number.isFinite(priceRangeVal)) {
      priceRangeValue = priceRangeVal;
      priceRangeFormatted = formatPrice(priceRangeVal);
    } else {
      priceRangeFormatted = "N/A";
    }
  });

  // Ensure priceMin/Max are numbers when changed
  function handlePriceMinChange(event: Event) {
    const input = event.target as HTMLInputElement;
    priceMin = input.value === "" ? null : Number(input.value);
  }
  function handlePriceMaxChange(event: Event) {
    const input = event.target as HTMLInputElement;
    priceMax = input.value === "" ? null : Number(input.value);
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
      <!-- ID for Intersection Observer -->
      <aside
        id="filter-section"
        class="flex flex-col border-l border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 transition-[width] duration-300 ease-in-out
                    {isFilterCollapsed ? 'sm:w-16 md:w-16' : 'sm:w-72 md:w-72'}"
      >
        <!-- ServerFilter Container - Grows and Scrolls -->
        <div class="flex-grow overflow-y-auto px-3 py-2">
          <ServerFilter {datacenters} {cpuModels} bind:isFilterCollapsed />
        </div>
        <!-- Timestamp/Loading Info - Fixed at bottom, animated with slide -->
        {#if !isFilterCollapsed}
          <div
            class="px-3 py-2"
            transition:slide={{ duration: 300, axis: "y" }}
          >
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
                    />{dayjs.unix(lastUpdate).format("DD.MM.YYYY HH:mm")}
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
            <div
              class="relative md:col-span-1 after:content-[''] after:absolute after:right-0 after:top-0 after:bottom-0 after:w-8 after:bg-gradient-to-l after:from-white after:to-transparent after:dark:from-gray-800 after:pointer-events-none md:after:hidden"
            >
              <div
                class="flex flex-nowrap gap-3 items-start overflow-x-auto scrollbar-hide text-xs text-gray-900 dark:text-gray-300"
              >
                <ButtonGroup class="flex-shrink-0">
                  <InputAddon
                    size="sm"
                    class="bg-gray-50 text-gray-900 dark:bg-gray-700 dark:text-gray-300"
                  >
                    <FontAwesomeIcon
                      icon={faEuroSign}
                      class="me-2 dark:text-gray-400"
                    />Price
                  </InputAddon>
                  <Input
                    size="sm"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="min"
                    data-testid="price-min-input"
                    class="text-xs w-12 bg-white dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    bind:value={priceMin}
                    onchange={handlePriceMinChange}
                  />
                  <Input
                    size="sm"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="max"
                    data-testid="price-max-input"
                    class="text-xs w-12 bg-white dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    bind:value={priceMax}
                    onchange={handlePriceMaxChange}
                  />
                </ButtonGroup>
                <ButtonGroup class="flex-shrink-0">
                  <InputAddon
                    size="sm"
                    class="bg-gray-50 text-gray-900 dark:bg-gray-700 dark:text-gray-300"
                  >
                    <FontAwesomeIcon class="me-2" icon={faFilter} />Filter
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
                      onclick={handleClearFilter}>Delete</Button
                    >
                  {/if}
                </ButtonGroup>
                <Tooltip placement="bottom" class="z-50 text-center">
                  Store current filter locally<br />
                  on your computer.
                </Tooltip>

                <ButtonGroup class="flex-shrink-0">
                  <InputAddon
                    size="sm"
                    class="bg-gray-50 text-gray-900 dark:bg-gray-700 dark:text-gray-300"
                  >
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
                        <input type="hidden" name="alertId" value={alert.id} />
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
                      <Tooltip placement="bottom" class="z-50 text-center">
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
          <div class="h-[320px] p-5">
            <ServerPriceChart
              data={serverPrices}
              {loading}
              timeUnitPrice={$settingsStore.timeUnitPrice}
            />
          </div>
        </div>

        <!-- QuickStats Section -->
        <div class="px-5">
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <!-- Total Available Configurations -->
            <QuickStat
              icon={faFilter}
              title="Total Configurations"
              value={totalResultsValue}
              subtitle="Available server configurations"
              size="sm"
            />

            <!-- Available Auctions -->
            <QuickStat
              icon={faStopwatch}
              title="Available Auctions"
              value={availableAuctionsValue}
              subtitle="Currently available auctions"
              size="sm"
            />
            
            <!-- Server Popularity -->
            <QuickStat
              data-testid="popularity-stat"
              icon={popularityValue && popularityValue > 1.2 ? faArrowUp : (popularityValue && popularityValue < 0.8 ? faArrowDown : faStopwatch)}
              title="Server Popularity"
              value={popularityFormatted}
              subtitle="Compared to 30-day average"
              valueClass={
                popularityValue && popularityValue > 1.2
                  ? "text-green-600 dark:text-green-400"
                  : (popularityValue && popularityValue < 0.8
                      ? "text-red-600 dark:text-red-400"
                      : "text-gray-900 dark:text-white")
              }
              size="sm"
            />

            <!-- Lowest Price -->
            <QuickStat
              icon={faEuroSign}
              title="Lowest Price"
              value={lowestPriceFormatted}
              subtitle="Most affordable option"
              valueClass="text-green-600 dark:text-green-400"
              size="sm"
            />

            <!-- Average Price -->
            <QuickStat
              icon={faEuroSign}
              title="Average Price"
              value={averagePriceFormatted}
              subtitle="Across all configurations"
              size="sm"
            />

            <!-- Price Range -->
            <QuickStat
              icon={faArrowDown}
              title="Price Range"
              value={priceRangeFormatted}
              subtitle="Highest minus lowest price"
              size="sm"
            />
          </div>
        </div>

        {#if browser && mounted}
          <!-- Defer rendering this section until client-side mount to avoid hydration issues -->
          <!-- ID for Intersection Observer -->
          <div
            id="results-section"
            class="flex flex-col sm:flex-row sm:justify-between sm:items-start mt-5 px-5"
          >
            <!-- Group heading and badge -->
            <div class="flex items-baseline">
              <h3
                class="text-left text-xl font-semibold text-gray-900 dark:text-white me-2"
              >
                Configurations
              </h3>
            </div>
            {#if !loading}
              <!-- Sort & Group controls: Stacked on mobile, right-aligned on larger screens -->
              <div
                class="flex flex-wrap items-center justify-start sm:justify-end gap-x-4 gap-y-2 text-gray-500 dark:text-gray-400 text-sm mt-2 sm:mt-0"
              >
                <GroupControls bind:groupByField />
                <SortControls bind:sortField bind:sortDirection />
              </div>
            {/if}
          </div>
          {#if !loading && totalResults > 100}
            <Alert class="mx-5 mb-5" color="red">
              <FontAwesomeIcon icon={faWarning} class="w-4 h-4 me-1" />
              We found more than 100 configurations and limited the results. Please
              use the filter to narrow down the results.</Alert
            >
          {/if}
          {#if loading}
            <!-- Loading Spinner -->
            <p
              class="mt-1 text-sm font-normal text-gray-500 dark:text-gray-400 ml-5"
            >
              <Spinner class="mr-2" /> Loading...
            </p>
          {:else}
            <!-- Content to show when NOT loading -->
            {#if totalResults > 0}
              <!-- Show >100 Alert if needed -->
              {#if totalResults > 100}
                <Alert class="mx-5 mb-5" color="red">
                  <FontAwesomeIcon icon={faWarning} class="w-4 h-4 me-1" />
                  We found more than 100 configurations and limited the results.
                  Please use the filter to narrow down the results.
                </Alert>
              {/if}

              <!-- Show Server List -->
              <ServerList
                groupedList={groupedDisplayList}
                {groupByField}
                timeUnitPrice={$settingsStore.timeUnitPrice}
              />
            {:else}
              <!-- Show No Results Alert -->
              <Alert class="mx-5 mt-4">
                <InfoCircleSolid slot="icon" class="w-5 h-5" />
                No servers matching the criteria were found. Try changing some of
                the parameters.
              </Alert>
            {/if}
          {/if}
        {/if}
        <!-- End of browser && mounted block -->
      </main>
    </div>

    <!-- Floating Action Buttons for Small Screens -->
    <FloatingActionButton
      icon={faArrowDown}
      targetSelector="#results-section"
      visible={isSmallScreen && filterIsIntersecting && !resultsAreIntersecting}
      priority={10}
      ariaLabel="Scroll to results"
    />
    <FloatingActionButton
      icon={faArrowUp}
      targetSelector="#filter-section"
      visible={isSmallScreen && !filterIsIntersecting && resultsAreIntersecting}
      priority={10}
      ariaLabel="Scroll to filter"
    />
  {/if}
</div>
