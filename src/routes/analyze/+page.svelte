<script lang="ts">
    import { enhance } from "$app/forms";
    import { invalidate, invalidateAll } from "$app/navigation";
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
    } from "$lib/api/frontend/stats";
    import AlertModal from "$lib/components/AlertModal.svelte";
    import DbLoadingProgress from "$lib/components/DBLoadingProgress.svelte";
    import OutdatedDataAlert from "$lib/components/OutdatedDataAlert.svelte";
    import ServerFilter from "$lib/components/ServerFilter.svelte";
    import ServerList from "$lib/components/ServerList.svelte";
    import ServerPriceChart from "$lib/components/ServerPriceChart.svelte";
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
    import { AsyncDuckDB } from "@duckdb/duckdb-wasm";
    import {
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
        Badge,
        Button,
        ButtonGroup,
        Tooltip,
    } from "flowbite-svelte";
    import { InfoCircleSolid } from "flowbite-svelte-icons";
    import Spinner from "flowbite-svelte/Spinner.svelte";
    import { onMount } from "svelte";
    import { db, dbInitProgress } from "../../stores/db";

    /** @type {{ data: import('./$types').PageData }} */
    export let data;

    let lastUpdate: number;
    let serverList: ServerConfiguration[] = [];
    let serverPrices: ServerPriceStat[] = [];
    let cpuModels: NameValuePair[] = [];
    let datacenters: NameValuePair[] = [];

    let timeUnitPrice = "perMonth";

    let queryTime: number | undefined;
    let loading = true;

    let selectedAlert = null;
    let alertDialogOpen = false;

    let storedFilter: ServerFilterType | null = null;

    function handleSaveFilter(e: Event) {
        saveFilter($filter);
        addToast({
            message: "Filter was saved to your local storage.",
            color: "green",
            icon: "success",
        });
        storedFilter = $filter;
        e.preventDefault();
        e.stopPropagation();
    }

    function handleClearFilter(e: Event) {
        clearFilter();
        addToast({
            message: "Filter was cleared from your local storage.",
            color: "green",
            icon: "success",
        });
        storedFilter = null;
        e.preventDefault();
        e.stopPropagation();
    }

    onMount(() => {
        storedFilter = loadFilter();
    });

    async function fetchData(db: AsyncDuckDB, filter: ServerFilterType) {
        loading = true;

        console.log("Fetching data with filter:", filter);
        let queryStart = performance.now();

        if (typeof pirsch !== "undefined") {
            pirsch("search", {});
        }

        await withDbConnections(db, async (conn1, conn2, conn3, conn4) => {
            try {
                [cpuModels, datacenters, serverPrices, serverList] =
                    await Promise.all([
                        getCPUModels(conn1, filter),
                        getDatacenters(conn2, filter),
                        getPrices(conn3, filter),
                        getConfigurations(conn4, filter),
                    ]);

                queryTime = performance.now() - queryStart;

                // refresh last update timestamp if older than 65m
                // not optimal yet because it requires users to refresh the
                // database or else we'll continue executing this query
                if (!lastUpdate || dayjs().diff(lastUpdate, "minute") > 65) {
                    withDbConnections(db, async (conn1) => {
                        let last = await getLastUpdated(conn1);
                        if (last.length > 0) {
                            lastUpdate = last[0].last_updated;
                        }
                    });
                }
            } catch (error: Error | any) {
                console.error("Error fetching data:", error);
                pirsch("search-error", { error: error?.message });
            } finally {
                loading = false;
            }
        });
    }

    const debouncedFetchData = debounce(fetchData, 500);

    let totalOffers = 0;
    $: totalOffers = Array.isArray(serverPrices)
        ? serverPrices.reduce((acc, val) => acc + val.count, 0)
        : 0;

    $: if (!!$db && $filter) {
        debouncedFetchData($db, $filter);
    }

    $: hasFilter = storedFilter !== null;
    $: updateStoredFilterDisabled = isIdenticalFilter($filter, storedFilter);
</script>

<div class="mx-auto max-w-[1680px]">
    <OutdatedDataAlert {lastUpdate} />
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
                class="border-r border-gray-200 dark:border-gray-700 dark:bg-gray-800 overflow-y-auto"
            >
                <div
                    class="h-full bg-white px-3 py-2 dark:bg-gray-800 md:border-l-gray-100 md:border-l-2 dark:md:border-gray-700"
                >
                    <ServerFilter {datacenters} {cpuModels} />
                    <div class="mt-4">
                        <hr class="mb-5" />
                        <div class="my-2">
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
            </aside>

            <main class="flex-grow overflow-y-auto bg-white">
                <div class="w-full">
                    <div
                        class="bg-white px-5 sm:border-t md:border-t-0 py-3 mb-3 flex
                        md:justify-between md:items-start text-left text-lg
                    font-semibold text-gray-900 dark:bg-gray-800 dark:text-white
                    border-b border-gray-2b00 dark:border-gray-700"
                    >
                        <div class="text-xs text-gray-900">
                            <ButtonGroup class="me-2">
                                <div
                                    class="text-center font-medium
                                focus-within:ring-2 focus-within:z-10
                                inline-flex items-center justify-center px-2
                                py-2 bg-gray-50 border
                                border-gray-200 first:rounded-s-lg
                                last:rounded-e-lg opacity-90"
                                >
                                    <FontAwesomeIcon
                                        class="me-2"
                                        icon={faFilter}
                                    /> Filter
                                </div>
                                <Button
                                    size="xs"
                                    color="alternative"
                                    class="shadow-sm"
                                    disabled={updateStoredFilterDisabled}
                                    on:click={handleSaveFilter}
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
                                        on:click={handleClearFilter}
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

                            <ButtonGroup>
                                <div
                                    class="text-center font-medium focus-within:ring-2 focus-within:z-10 inline-flex items-center justify-center px-2 py-2 bg-gray-50 border border-gray-200 first:rounded-s-lg last:rounded-e-lg opacity-90"
                                >
                                    <FontAwesomeIcon
                                        class="text-orange-500 me-2"
                                        icon={faBell}
                                    /> Alert
                                </div>
                                {#await data?.alert then alert}
                                    {#if alert}
                                        <Button
                                            color="alternative"
                                            size="xs"
                                            id="price-alert"
                                            on:click={(e) => {
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
                                                    message:
                                                        "Alert deleted successfully.",
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
                                                on:click={(e) => {
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
                                            on:click={(e) => {
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
                        <div class="text-xs text-gray-900">
                            <ButtonGroup>
                                <div
                                    class="text-center font-medium focus-within:ring-2 focus-within:z-10 inline-flex items-center justify-center px-2 py-2 bg-gray-50 border border-gray-200 first:rounded-s-lg last:rounded-e-lg opacity-90"
                                >
                                    <FontAwesomeIcon
                                        icon={faEuroSign}
                                        class="mr-2"
                                    /> Rate
                                </div>
                                <Button
                                    class="px-2"
                                    size="xs"
                                    disabled={timeUnitPrice === "perHour"}
                                    on:click={() => (timeUnitPrice = "perHour")}
                                    >hourly</Button
                                >
                                <Button
                                    class="px-2"
                                    size="xs"
                                    disabled={timeUnitPrice === "perMonth"}
                                    on:click={() =>
                                        (timeUnitPrice = "perMonth")}
                                    >monthly</Button
                                >
                            </ButtonGroup>
                            <Tooltip placement="left" class="z-50">
                                Display prices per hour or per month.
                            </Tooltip>
                        </div>
                    </div>
                    <h1
                        class="bg-white px-5 text-left text-xl font-semibold text-gray-900 dark:bg-gray-800 dark:text-white"
                    >
                        Price History
                    </h1>
                    <div class="border-b -pb-5">
                        <ServerPriceChart
                            data={serverPrices}
                            {loading}
                            {timeUnitPrice}
                        />
                    </div>
                </div>

                <div class="flex justify-between items-start mt-5 px-5 pb-5">
                    <h3
                        class="bg-white text-left text-xl font-semibold text-gray-900 dark:bg-gray-800 dark:text-white"
                    >
                        Configurations
                    </h3>
                    {#if !loading}
                        <div class="text-gray-500 text-sm mt-1">
                            <Badge color="green" rounded
                                >{serverList.length > 100
                                    ? "more than 100"
                                    : serverList.length} results</Badge
                            >
                        </div>
                    {/if}
                </div>
                {#if !loading && serverList.length > 100}
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
                {:else if serverList.length === 0}
                    <Alert class="mx-5"
                        ><InfoCircleSolid slot="icon" class="w-5 h-5" />No
                        servers matching the criteria were found. Try changing
                        some of the parameters.</Alert
                    >
                {:else}
                    <ServerList {serverList} {loading} {timeUnitPrice} />
                {/if}
            </main>
        </div>
    {/if}
</div>
