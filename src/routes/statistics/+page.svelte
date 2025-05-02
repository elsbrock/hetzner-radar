<script lang="ts">
  import { withDbConnections } from "$lib/api/frontend/dbapi";
  import {
    getCPUVendorPriceStats,
    getDiskPriceStats,
    getGPUPriceStats,
    getPriceIndexStats,
    getRamPriceStats,
    getVolumeStats,
    type TemporalStat,
  } from "$lib/api/frontend/stats";
  import LineChart from "$lib/components/LineChart.svelte";
  import type { AsyncDuckDB } from "@duckdb/duckdb-wasm";
  import {
    faArrowDown,
    faArrowUp,
    faChartLine,
    faHdd,
    faMemory,
    faMicrochip,
    faServer,
  } from "@fortawesome/free-solid-svg-icons";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { db } from "../../stores/db";

  let loading = $state(true);

  let dailyPriceIndexStats = $state<TemporalStat[]>([]);
  let ramWithECCPriceStats = $state<TemporalStat[]>([]);
  let ramWithoutECCPriceStats = $state<TemporalStat[]>([]);
  let hddPriceStats = $state<TemporalStat[]>([]);
  let nvmePriceStats = $state<TemporalStat[]>([]);
  let sataPriceStats = $state<TemporalStat[]>([]);
  let gpuPriceStats = $state<TemporalStat[]>([]);
  let cpuVendorAMDStats = $state<TemporalStat[]>([]);
  let cpuVendorIntelStats = $state<TemporalStat[]>([]);
  let volumeFinlandStats = $state<TemporalStat[]>([]);
  let volumeGermanyStats = $state<TemporalStat[]>([]);

  // Derived values for quick stats
  let currentPriceIndex = $derived(
    dailyPriceIndexStats.length > 0
      ? dailyPriceIndexStats[dailyPriceIndexStats.length - 1].y
      : null
  );

  let priceIndexTrend = $derived(
    dailyPriceIndexStats.length >= 30
      ? (() => {
          const currentIndex =
            dailyPriceIndexStats[dailyPriceIndexStats.length - 1].y;
          const thirtyDaysAgoIndex =
            dailyPriceIndexStats[dailyPriceIndexStats.length - 30].y;

          return thirtyDaysAgoIndex === 0
            ? null
            : ((currentIndex - thirtyDaysAgoIndex) / thirtyDaysAgoIndex) * 100;
        })()
      : null
  );

  let isPriceRising = $derived(priceIndexTrend !== null && priceIndexTrend > 0);

  // New derived values for additional quick stats

  // 1. Lowest current server price
  let lowestServerPrice = $derived(
    cpuVendorAMDStats.length > 0 && cpuVendorIntelStats.length > 0
      ? Math.min(
          cpuVendorAMDStats[cpuVendorAMDStats.length - 1]?.y || Infinity,
          cpuVendorIntelStats[cpuVendorIntelStats.length - 1]?.y || Infinity
        )
      : null
  );

  // 2. AMD vs Intel price comparison
  let amdVsIntelPrice = $derived(
    cpuVendorAMDStats.length > 0 && cpuVendorIntelStats.length > 0
      ? {
          amd: cpuVendorAMDStats[cpuVendorAMDStats.length - 1]?.y,
          intel: cpuVendorIntelStats[cpuVendorIntelStats.length - 1]?.y,
          difference: (
            ((cpuVendorAMDStats[cpuVendorAMDStats.length - 1]?.y -
              cpuVendorIntelStats[cpuVendorIntelStats.length - 1]?.y) /
              cpuVendorIntelStats[cpuVendorIntelStats.length - 1]?.y) *
            100
          ).toFixed(1),
        }
      : null
  );

  // 3. RAM price comparison (ECC vs non-ECC)
  let ramPriceComparison = $derived(
    ramWithECCPriceStats.length > 0 && ramWithoutECCPriceStats.length > 0
      ? {
          withECC: ramWithECCPriceStats[ramWithECCPriceStats.length - 1]?.y,
          withoutECC:
            ramWithoutECCPriceStats[ramWithoutECCPriceStats.length - 1]?.y,
          difference: (
            ((ramWithECCPriceStats[ramWithECCPriceStats.length - 1]?.y -
              ramWithoutECCPriceStats[ramWithoutECCPriceStats.length - 1]?.y) /
              ramWithoutECCPriceStats[ramWithoutECCPriceStats.length - 1]?.y) *
            100
          ).toFixed(1),
        }
      : null
  );

  // 4. Storage price comparison (NVMe vs HDD)
  let storagePriceComparison = $derived(
    nvmePriceStats.length > 0 && hddPriceStats.length > 0
      ? {
          nvme: nvmePriceStats[nvmePriceStats.length - 1]?.y,
          hdd: hddPriceStats[hddPriceStats.length - 1]?.y,
          ratio: (
            nvmePriceStats[nvmePriceStats.length - 1]?.y /
            hddPriceStats[hddPriceStats.length - 1]?.y
          ).toFixed(1),
        }
      : null
  );

  // 5. Server availability by location
  let serverAvailability = $derived(
    volumeFinlandStats.length > 0 && volumeGermanyStats.length > 0
      ? {
          finland: volumeFinlandStats[volumeFinlandStats.length - 1]?.y,
          germany: volumeGermanyStats[volumeGermanyStats.length - 1]?.y,
          mostAvailable:
            volumeFinlandStats[volumeFinlandStats.length - 1]?.y >
            volumeGermanyStats[volumeGermanyStats.length - 1]?.y
              ? "Finland"
              : "Germany",
        }
      : null
  );

  async function fetchData(db: AsyncDuckDB) {
    let queryTime = performance.now();
    loading = true;

    await withDbConnections(db, async (conn1, conn2, conn3, conn4, conn5) => {
      try {
        [
          dailyPriceIndexStats,
          ramWithECCPriceStats,
          ramWithoutECCPriceStats,
          hddPriceStats,
          nvmePriceStats,
          sataPriceStats,
          gpuPriceStats,
          cpuVendorAMDStats,
          cpuVendorIntelStats,
          volumeFinlandStats,
          volumeGermanyStats,
        ] = await Promise.all([
          getPriceIndexStats(conn1),
          getRamPriceStats(conn2, true),
          getRamPriceStats(conn3, false),
          getDiskPriceStats(conn4, "hdd"),
          getDiskPriceStats(conn5, "nvme"),
          getDiskPriceStats(conn1, "sata"),
          getGPUPriceStats(conn1),
          getCPUVendorPriceStats(conn2, "AMD"),
          getCPUVendorPriceStats(conn2, "Intel"),
          getVolumeStats(conn3, "Finland"),
          getVolumeStats(conn3, "Germany"),
        ]);
        queryTime = performance.now() - queryTime;
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        loading = false;
      }
    });
  }

  $effect(() => {
    if (!!$db) {
      fetchData($db);
    }
  });
</script>

<div class="p-8 bg-gray-50 dark:bg-gray-900">
  <section class="mx-auto my-12 max-w-7xl text-center">
    <h1 class="mb-6 text-5xl font-extrabold text-gray-800 dark:text-gray-100">
      Dive into our Auction Statistics
    </h1>
    <p class="text-lg text-gray-600 dark:text-gray-400 mb-10">
      Explore comprehensive insights into server availability, pricing trends,
      and configuration distributions to optimize your infrastructure
      investments.
    </p>
  </section>

  <!-- Quick Stats Section -->
  <div class="mx-auto mb-8 max-w-7xl">
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <!-- Current Price Index -->
      <div
        class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 flex items-center"
      >
        <div class="mr-4">
          <FontAwesomeIcon
            icon={faChartLine}
            class="w-10 h-10 text-orange-500"
          />
        </div>
        <div>
          <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300">
            Current Price Index
          </h3>
          {#if currentPriceIndex !== null}
            <p class="text-3xl font-bold text-gray-900 dark:text-white">
              {currentPriceIndex.toFixed(3)}
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Values above 1.0 indicate higher than average prices
            </p>
          {:else}
            <div
              class="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-1 mb-2"
            ></div>
            <div
              class="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
            ></div>
          {/if}
        </div>
      </div>

      <!-- 30-Day Price Trend -->
      <div
        class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 flex items-center"
      >
        <div class="mr-4">
          <FontAwesomeIcon
            icon={isPriceRising ? faArrowUp : faArrowDown}
            class="w-10 h-10 {isPriceRising
              ? 'text-red-500'
              : 'text-green-500'}"
          />
        </div>
        <div>
          <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300">
            30-Day Price Trend
          </h3>
          {#if priceIndexTrend !== null}
            <p
              class="text-3xl font-bold {isPriceRising
                ? 'text-red-600 dark:text-red-400'
                : 'text-green-600 dark:text-green-400'}"
            >
              {isPriceRising ? "+" : ""}{priceIndexTrend.toFixed(2)}%
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {isPriceRising ? "Prices are rising" : "Prices are falling"} compared
              to 30 days ago
            </p>
          {:else}
            <div
              class="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-1 mb-2"
            ></div>
            <div
              class="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
            ></div>
          {/if}
        </div>
      </div>

      <!-- Lowest Server Price -->
      <div
        class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 flex items-center"
      >
        <div class="mr-4">
          <FontAwesomeIcon icon={faServer} class="w-10 h-10 text-blue-500" />
        </div>
        <div>
          <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300">
            Lowest Server Price
          </h3>
          {#if lowestServerPrice !== null}
            <p class="text-3xl font-bold text-gray-900 dark:text-white">
              €{lowestServerPrice.toFixed(2)}
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Cheapest server currently available
            </p>
          {:else}
            <div
              class="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-1 mb-2"
            ></div>
            <div
              class="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
            ></div>
          {/if}
        </div>
      </div>

      <!-- AMD vs Intel Price -->
      <div
        class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 flex items-center"
      >
        <div class="mr-4">
          <FontAwesomeIcon icon={faMicrochip} class="w-10 h-10 text-red-500" />
        </div>
        <div>
          <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300">
            AMD vs Intel Price
          </h3>
          {#if amdVsIntelPrice !== null}
            <p class="text-3xl font-bold text-gray-900 dark:text-white">
              {amdVsIntelPrice.difference}%
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              AMD is {parseFloat(amdVsIntelPrice.difference) < 0
                ? "cheaper than"
                : "more expensive than"} Intel
            </p>
          {:else}
            <div
              class="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-1 mb-2"
            ></div>
            <div
              class="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
            ></div>
          {/if}
        </div>
      </div>

      <!-- RAM Price Comparison -->
      <div
        class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 flex items-center"
      >
        <div class="mr-4">
          <FontAwesomeIcon icon={faMemory} class="w-10 h-10 text-purple-500" />
        </div>
        <div>
          <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300">
            ECC RAM Premium
          </h3>
          {#if ramPriceComparison !== null}
            <p class="text-3xl font-bold text-gray-900 dark:text-white">
              {ramPriceComparison.difference}%
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              ECC RAM costs {ramPriceComparison.difference}% more per GB
            </p>
          {:else}
            <div
              class="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-1 mb-2"
            ></div>
            <div
              class="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
            ></div>
          {/if}
        </div>
      </div>

      <!-- Storage Price Comparison -->
      <div
        class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 flex items-center"
      >
        <div class="mr-4">
          <FontAwesomeIcon icon={faHdd} class="w-10 h-10 text-green-500" />
        </div>
        <div>
          <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300">
            NVMe vs HDD Price
          </h3>
          {#if storagePriceComparison !== null}
            <p class="text-3xl font-bold text-gray-900 dark:text-white">
              {storagePriceComparison.ratio}x
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              NVMe storage costs {storagePriceComparison.ratio}x more per TB
            </p>
          {:else}
            <div
              class="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-1 mb-2"
            ></div>
            <div
              class="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
            ></div>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <div class="mx-auto my-12 max-w-7xl">
    <div
      class="my-6 overflow-hidden rounded-lg bg-white shadow-sm dark:bg-gray-800"
    >
      <div class="p-6">
        <h3 class="text-xl font-bold text-gray-900 dark:text-white">
          Overall Price Index
        </h3>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
          The Overall Price Index represents the relative trend of server prices
          over time, calculated using the lowest auction price for each
          configuration category on a daily basis. It compares daily prices to a
          90-day median baseline for similar configurations, providing insight
          into whether the market is currently cheap, average, or expensive.
        </p>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
          An index value close to 1.0 indicates median market prices. Values
          above 1.0 suggest that servers are currently more expensive than the
          median, while values below 1.0 indicate lower-than-median prices. This
          index can both increase and decrease based on actual market
          conditions, allowing you to identify the best times to purchase
          servers.
        </p>
      </div>
      <div class="h-80 w-full">
        <LineChart
          data={[{ name: "Price Index", data: dailyPriceIndexStats }]}
          options={{
            scales: {
              y: {
                title: {
                  display: true,
                  text: "Index",
                },
                ticks: {
                  callback: function (tickValue: number | string) {
                    if (typeof tickValue === "number") {
                      return tickValue.toFixed(3);
                    }
                    return tickValue;
                  },
                },
              },
            },
          }}
        />
      </div>
    </div>
    <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
      <!-- RAM Price Over Time -->
      <div
        class="overflow-hidden rounded-lg bg-white shadow-md dark:bg-gray-800"
      >
        <div class="p-6">
          <h3 class="text-xl font-bold text-gray-900 dark:text-white">
            RAM Price Over Time
          </h3>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Track the price trends for RAM over time. Use this to gauge when
            it's most cost-effective to invest in memory-intensive servers.
          </p>
        </div>
        <div class="h-80 w-full">
          <LineChart
            data={[
              { name: "With ECC", data: ramWithECCPriceStats },
              { name: "Without ECC", data: ramWithoutECCPriceStats },
            ]}
          />
        </div>
      </div>

      <!-- Disk Price Over Time -->
      <div
        class="overflow-hidden rounded-lg bg-white shadow-md dark:bg-gray-800"
      >
        <div class="p-6">
          <h3 class="text-xl font-bold text-gray-900 dark:text-white">
            Disk Price Over Time
          </h3>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Explore how the price of one GB HDD storage has fluctuated over
            time. This data can help you determine the best time to purchase
            storage-heavy configurations.
          </p>
        </div>
        <div class="h-80 w-full">
          <LineChart data={[{ name: "HDD Price", data: hddPriceStats }]} />
        </div>
      </div>

      <!-- SSD Price Over Time -->
      <div
        class="overflow-hidden rounded-lg bg-white shadow-md dark:bg-gray-800"
      >
        <div class="p-6">
          <h3 class="text-xl font-bold text-gray-900 dark:text-white">
            SSD Price Over Time
          </h3>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            See how one GB of SSD storage have changed over time, allowing you
            to plan your purchases for configurations that rely on fast storage
            solutions.
          </p>
        </div>
        <div class="h-80 w-full">
          <LineChart
            data={[
              { name: "NVMe", data: nvmePriceStats },
              { name: "SATA", data: sataPriceStats },
            ]}
          />
        </div>
      </div>

      <!-- Cheapest GPU Configuration -->
      <div
        class="overflow-hidden rounded-lg bg-white shadow-md dark:bg-gray-800"
      >
        <div class="p-6">
          <h3 class="text-xl font-bold text-gray-900 dark:text-white">
            Cheapest GPU Configuration
          </h3>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Compare the price trends for servers with GPUs to make informed
            decisions when selecting a graphics card for your server.
          </p>
        </div>
        <div class="h-80 w-full">
          <LineChart data={[{ name: "GPU", data: gpuPriceStats }]} />
        </div>
      </div>

      <!-- Volume by Country -->
      <div
        class="overflow-hidden rounded-lg bg-white shadow-md dark:bg-gray-800"
      >
        <div class="p-6">
          <h3 class="text-xl font-bold text-gray-900 dark:text-white">
            Volume by Country
          </h3>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Analyze the volume of servers deployed in different regions to
            identify trends and make informed decisions about where to expand
            your infrastructure.
          </p>
        </div>
        <div class="h-80 w-full">
          <LineChart
            data={[
              { name: "Finland", data: volumeFinlandStats },
              { name: "Germany", data: volumeGermanyStats },
            ]}
            options={{
              scales: {
                y: {
                  stacked: true,
                  title: {
                    display: true,
                    text: "Volume",
                  },
                  ticks: {
                    callback: function (tickValue: number | string) {
                      if (typeof tickValue === "number") {
                        return tickValue.toFixed(0);
                      }
                      return tickValue;
                    },
                  },
                },
              },
              plugins: {
                tooltip: {
                  mode: "index",
                },
              },
            }}
          />
        </div>
      </div>

      <!-- CPU Vendors -->
      <div
        class="overflow-hidden rounded-lg bg-white shadow-md dark:bg-gray-800"
      >
        <div class="p-6">
          <h3 class="text-xl font-bold text-gray-900 dark:text-white">
            CPU Vendors
          </h3>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Compare the minimum prices for servers with CPUs from different
            vendors to make informed decisions when selecting a processor for
            your server.
          </p>
        </div>
        <div class="h-80 w-full">
          <LineChart
            data={[
              { name: "AMD", data: cpuVendorAMDStats },
              { name: "Intel", data: cpuVendorIntelStats },
            ]}
          />
        </div>
      </div>
    </div>
  </div>
</div>
