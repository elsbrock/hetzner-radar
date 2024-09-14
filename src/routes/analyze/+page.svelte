<script context="module" lang="ts">
	declare let pirsch: any;
</script>

<script lang="ts">
	import { db, dbInitProgress } from "../../stores/db";
	import type {
		NameValuePair,
		ServerConfiguration,
		ServerDetail,
		ServerFilter as ServerFilterType,
		ServerLowestPriceStat,
		ServerPriceStat,
	} from "$lib/dbapi";
	import {
		getLastUpdated,
		getCPUModels,
		getDatacenters,
		getConfigurations,
		getPrices,
		withDbConnections,
		getServerDetails,
		getServerDetailPrices,
		getLowestServerDetailPrices,
	} from "$lib/dbapi";
	import { Progressbar } from "flowbite-svelte";
	import ServerFilter from "$lib/components/ServerFilter.svelte";
	import ServerTable from "$lib/components/ServerTable.svelte";
	import ServerPriceChart from "$lib/components/ServerPriceChart.svelte";
	import { AsyncDuckDB } from "@duckdb/duckdb-wasm";
	import queryString from "query-string";
	import { onMount } from "svelte";
	import dayjs from 'dayjs';
	import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
	import { faClockRotateLeft, faStopwatch } from "@fortawesome/free-solid-svg-icons";

	let filter: ServerFilterType = {
		recentlySeen: false,

		locationGermany: true,
		locationFinland: true,

		cpuCount: 1,
		cpuIntel: true,
		cpuAMD: true,

		ramInternalSize: [4, 6],

		ssdNvmeCount: [0, 0],
		ssdNvmeInternalSize: [1, 12],

		ssdSataCount: [0, 0],
		ssdSataInternalSize: [1, 4],

		hddCount: [0, 2],
		hddInternalSize: [4, 16],

		selectedDatacenters: [],
		selectedCpuModels: [],

		extrasECC: null,
		extrasINIC: null,
		extrasHWR: false,
		extrasGPU: false,
		extrasRPS: false,
	};

	let lastUpdated: number;
	let serverList: ServerConfiguration[] = [];
	let serverPrices: ServerPriceStat[] = [];
	let cpuModels: NameValuePair[] = [];
	let datacenters: NameValuePair[] = [];
	let serverDetails: ServerDetail[];
	let serverDetailPrices: ServerPriceStat[];
	let lowestServerDetailPrices: ServerLowestPriceStat[];

	let queryTime: number | undefined;
	let loading = true;

	async function fetchData(db: AsyncDuckDB, filter: ServerFilterType) {
		console.log("Fetching data with filter:", filter);
		let queryStart = performance.now();

		if (typeof pirsch !== "undefined") {
			pirsch("search", {});
		}

		await withDbConnections(db, async (conn1, conn2, conn3, conn4) => {
			try {
				[cpuModels, datacenters, serverPrices, serverList] = await Promise.all([
					getCPUModels(conn1, filter),
					getDatacenters(conn2, filter),
					getPrices(conn3, filter),
					getConfigurations(conn4, filter),
				]);

				queryTime = performance.now() - queryStart;
			} catch (error: Error | any) {
				console.error("Error fetching data:", error);
				pirsch("search-error", { error: error?.message });
			} finally {
				loading = false;
			}
		});
	}

	async function handleServerDetails(event: any) {
		return withDbConnections($db!, async (conn1, conn2, conn3) => {
			[serverDetails, serverDetailPrices, lowestServerDetailPrices] =
				await Promise.all([
					getServerDetails(conn1, serverList[event.detail]),
					getServerDetailPrices(conn2, serverList[event.detail]),
					getLowestServerDetailPrices(conn3, serverList[event.detail]),
				]);
		});
	}

	onMount(async () => {
		if (typeof window !== "undefined") {
			const hash = window.location.hash.substring(1); // Remove the '#'
			const params = new URLSearchParams(hash.replace(/^filter.v1=/, ""));
			const deserializedFilter = queryString.parse(params.toString(), {
				arrayFormat: "bracket",
				parseBooleans: true,
			});
			filter = {
				...filter,
				...deserializedFilter,
			};
		}
	});

	function debounce(fn: any, delay: number) {
		let timeoutID: number;
		return function(...args: any) {
			clearTimeout(timeoutID);
			loading = true;
			timeoutID = setTimeout(() => fn(...args), timeoutID ? delay : 0) as any;
		};
	}

	const debouncedFetchData = debounce(fetchData, 500);
	$: if (!!$db) {
		// TODO: generate at build time
		if (!lastUpdated) {
			withDbConnections($db, async (conn1) => {
				let lastUpdate = await getLastUpdated(conn1);
				if (lastUpdate.length > 0) {
					lastUpdated = lastUpdate[0].last_updated;
				}
			});
		}
		debouncedFetchData($db, filter);
	}

	let totalOffers = 0;
	$: totalOffers = Array.isArray(serverPrices)
		? serverPrices.reduce((acc, val) => acc + val.count, 0)
		: 0;
</script>

{#if !Number.isNaN($dbInitProgress) && $dbInitProgress < 100}
	<div class="flex min-h-screen items-center justify-center">
		<div class="w-[40vw]">
			<Progressbar {$dbInitProgress} labelOutside="Loading data…" />
		</div>
	</div>
{:else}
	<div
		class="grid min-h-screen grid-cols-1 sm:grid-cols-1 lg:grid-cols-[auto,1fr]"
	>
		<aside
		class="border-r border-gray-200 dark:border-gray-700 dark:bg-gray-800 overflow-y-auto">
			<div class="h-full bg-white px-3 py-2 dark:bg-gray-800">
				<ServerFilter bind:filter {datacenters} {cpuModels} />
				<div class="mt-4">
					<hr class="mb-5" />
						{#if lastUpdated}
							<p class="mt-2 text-center text-xs italic text-gray-500 dark:text-gray-400">
								<FontAwesomeIcon icon={faClockRotateLeft} class="me-1"/>{dayjs.unix(lastUpdated).format('DD.MM.YYYY HH:mm')}
							</p>
						{/if}
						{#if queryTime}
							<p class="mt-2 text-center text-xs italic text-gray-500 dark:text-gray-400">
								<FontAwesomeIcon icon={faStopwatch} class="me-1"/>completed in {queryTime.toFixed(0)}ms
							</p>
						{/if}
					</div>
			</div>
		</aside>

		<main class="flex-grow overflow-y-auto pt-3">
			<div class="w-full">
				<h3
					class="bg-white px-5 pb-5 text-left text-lg font-semibold text-gray-900 dark:bg-gray-800 dark:text-white"
				>
					Pricing
					<p class="mt-1 text-sm font-normal text-gray-500 dark:text-gray-400">
						View the minimum, mean, and maximum server prices observed for the
						given configuration over the last three months. {#if totalOffers > 0}A
							total of {totalOffers} offers have been seen.{/if}
					</p>
				</h3>
				<ServerPriceChart data={serverPrices} {loading} />
			</div>
			<h3
				class="bg-white px-5 pb-5 text-left text-lg font-semibold text-gray-900 dark:bg-gray-800 dark:text-white"
			>
				Configurations
				<p class="mt-1 text-sm font-normal text-gray-500 dark:text-gray-400">
					Below is a list of unique server configurations we have observed over time. It includes their
					minimum prices and the dates the configurations were last seen. Keep in mind that this is not
					equal to the total number of servers that were offered, which is usually much
					higher. You can see the bid volume in the chart above.
				</p>
			</h3>
			<ServerTable
				data={serverList}
				on:serverDetails={handleServerDetails}
				{serverDetails}
				{serverDetailPrices}
				{lowestServerDetailPrices}
				{loading}
			/>
		</main>
	</div>
{/if}
