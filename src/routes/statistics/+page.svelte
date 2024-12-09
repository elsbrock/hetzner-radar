<script lang="ts">
  import {
    getCPUVendorPriceStats,
    getDiskPriceStats,
    getGPUPriceStats,
    getPriceIndexStats,
    getRamPriceStats,
    getVolumeStats
  } from "$lib/api/frontend/stats";
  import LineChart from "$lib/components/LineChart.svelte";
  import { Spinner } from "flowbite-svelte";
  import { db } from "../../stores/db";
</script>

<div class="p-8 bg-gray-50">
  <section class="mx-auto my-12 max-w-7xl text-center">
    <h1 class="mb-6 text-5xl font-extrabold text-gray-800">
      Dive into our Auction Statistics
    </h1>
    <p class="text-lg text-gray-600 mb-10">
      Explore comprehensive insights into server availability, pricing trends,
      and configuration distributions to optimize your infrastructure
      investments.
    </p>
  </section>

{#if !!$db}
{#await $db.connect()}
  <Spinner />
{:then conn}
  <div class="mx-auto my-12 max-w-7xl">
    <div
      class="my-6 overflow-hidden rounded-lg bg-white shadow-sm dark:bg-gray-800"
    >
			<div class="p-6">
				<h3 class="text-xl font-bold text-gray-900 dark:text-white">
					Overall Price Index
				</h3>
				<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
					The Overall Price Index represents the relative trend of server prices over time, calculated using the lowest auction price for each configuration category on a daily basis. It compares daily prices to historical averages for similar configurations, providing insight into whether the market is currently cheap, average, or expensive.
				</p>
				<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
					An index value close to 1.0 indicates average market prices. Values above 1.0 suggest that servers are generally more expensive than usual, while values below 1.0 indicate lower-than-average prices. Use this index to identify the best times to purchase servers based on market trends.
				</p>
			</div>
      <div class="h-80 w-full">
        <LineChart
          data={[{ name: "Price Index", data: getPriceIndexStats(conn) }]}
          options={{
            yaxis: {
							title: {
								text: 'Index',
							},
							labels: {
								formatter: function (value: number) {
									return value.toFixed(3);
								},
							},
						}
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
              { name: "With ECC", data: getRamPriceStats(conn, true) },
              { name: "Without ECC", data: getRamPriceStats(conn, false) },
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
          <LineChart data={[{ name: "HDD Price", data: getDiskPriceStats(conn, "hdd") }]} />
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
              { name: "NVMe", data: getDiskPriceStats(conn, "nvme") },
              { name: "SATA", data: getDiskPriceStats(conn, "sata") },
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
          <LineChart data={[{ name: "GPU", data: getGPUPriceStats(conn) }]} />
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
              { name: "Finland", data: getVolumeStats(conn, "Finland") },
              { name: "Germany", data: getVolumeStats(conn, "Germany") },
            ]}
            options={{
              chart: {
                stacked: true,
                type: "area",
              },
              yaxis: {
                title: {
                  text: "Volume",
                },
                labels: {
                  formatter: function (value) {
                    return value.toFixed(0);
                  },
                },
              },
              dataLabels: {
                enabled: false,
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
            Compare the minimum prices for servers with CPUs from different vendors to make
            informed decisions when selecting a processor for your server.
          </p>
        </div>
        <div class="h-80 w-full">
          <LineChart
            data={[
              { name: "AMD", data: getCPUVendorPriceStats(conn, "AMD") },
              { name: "Intel", data: getCPUVendorPriceStats(conn, "Intel") },
            ]}
          />
        </div>
      </div>
    </div>
  </div>
  {/await}
  {/if}
</div>
