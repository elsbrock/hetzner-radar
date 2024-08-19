<script context="module" lang="ts">
	declare let umami: any;
</script>

<script lang="ts">
	import { db, dbInitProgress } from "../../stores/db";
	import type {
		NameValuePair,
		ServerConfiguration,
		ServerDetail,
		ServerFilter,
		ServerLowestPriceStat,
		ServerPriceStat,
	} from "$lib/dbapi";
	import {
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
	import Filter from "$lib/components/Filter.svelte";
	import ServerTable from "$lib/components/ServerTable.svelte";
	import ServerPriceChart from "$lib/components/ServerPriceChart.svelte";
	import { AsyncDuckDB } from "@duckdb/duckdb-wasm";
	import queryString from "query-string";
	import { onMount } from "svelte";

	let filter: ServerFilter = {
		locationGermany: true,
		locationFinland: true,

		cpuCount: 1,
		cpuIntel: true,
		cpuAMD: true,

		ramInternalSizeLower: 4,
		ramInternalSizeUpper: 6,

		ssdNvmeCountLower: 2,
		ssdNvmeCountUpper: 5,
		ssdNvmeInternalSizeLower: 8,
		ssdNvmeInternalSizeUpper: 12,

		ssdSataCountLower: 0,
		ssdSataCountUpper: 5,
		ssdSataInternalSizeLower: 8,
		ssdSataInternalSizeUpper: 12,

		hddCountLower: 0,
		hddCountUpper: 5,
		hddInternalSizeLower: 8,
		hddInternalSizeUpper: 12,

		selectedDatacenters: [],
		selectedCpuModels: [],

		extrasECC: null,
		extrasINIC: null,
		extrasHWR: false,
		extrasGPU: false,
	};

	let serverList: ServerConfiguration[] = [];
	let serverPrices: ServerPriceStat[] = [];
	let cpuModels: NameValuePair[] = [];
	let datacenters: NameValuePair[] = [];
	let serverDetails: ServerDetail[];
	let serverDetailPrices: ServerPriceStat[];
	let lowestServerDetailPrices: ServerLowestPriceStat[];

	let loading = true;

	async function fetchData(db: AsyncDuckDB, filter: ServerFilter) {
		console.log("Fetching data with filter:", filter);
		let queryTime = performance.now();
		loading = true;

		if (typeof umami !== "undefined") {
			umami.track("search");
		}

		await withDbConnections(db, async (conn1, conn2, conn3, conn4) => {
			try {
				[cpuModels, datacenters, serverPrices, serverList] = await Promise.all([
					getCPUModels(conn1, filter),
					getDatacenters(conn2, filter),
					getPrices(conn3, filter),
					getConfigurations(conn4, filter),
				]);

				queryTime = performance.now() - queryTime;
			} catch (error) {
				console.error("Error fetching data:", error);
				umami.track("search-error");
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
			window.history.replaceState({}, document.title, window.location.pathname);
			filter = {
				...filter,
				...deserializedFilter,
			};
		}
	});

	$: if (!!$db) {
		fetchData($db, filter);
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
		<Filter bind:filter {datacenters} {cpuModels} />

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
