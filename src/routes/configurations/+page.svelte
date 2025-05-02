<script lang="ts">
  import {
    getCheapestConfigurations,
    getCheapestDiskConfigurations,
    getCheapestNvmeConfigurations,
    getCheapestRamConfigurations,
    getCheapestSataConfigurations,
  } from "$lib/api/frontend/configs";
  import { withDbConnections } from "$lib/api/frontend/dbapi";
  import { type ServerConfiguration } from "$lib/api/frontend/filter";
  import PriceControls from "$lib/components/PriceControls.svelte";
  import ServerCard from "$lib/components/ServerCard.svelte";
  import Spinner from "flowbite-svelte/Spinner.svelte";

  import { settingsStore } from "$lib/stores/settings";
  import type { AsyncDuckDB } from "@duckdb/duckdb-wasm";
  import {
    faCloud,
    faCode,
    faDatabase,
    faGamepad,
    faMemory,
    faShieldAlt,
  } from "@fortawesome/free-solid-svg-icons";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { Button } from "flowbite-svelte";
  import { db } from "../../stores/db";

  let loading = $state(true);

  let cheapestConfigurations: ServerConfiguration[] = $state([]);
  let cheapDiskConfigurations: ServerConfiguration[] = $state([]);
  let cheapRamConfigurations: ServerConfiguration[] = $state([]);
  let cheapNvmeConfigurations: ServerConfiguration[] = $state([]);
  let cheapSataConfigurations: ServerConfiguration[] = $state([]);

  async function fetchData(db: AsyncDuckDB) {
    let queryTime = performance.now();
    loading = true;

    await withDbConnections(db, async (conn1, conn2, conn3, conn4, conn5) => {
      try {
        [
          cheapestConfigurations,
          cheapDiskConfigurations,
          cheapRamConfigurations,
          cheapNvmeConfigurations,
          cheapSataConfigurations,
        ] = await Promise.all([
          getCheapestConfigurations(conn1),
          getCheapestDiskConfigurations(conn2),
          getCheapestRamConfigurations(conn3),
          getCheapestNvmeConfigurations(conn4),
          getCheapestSataConfigurations(conn5),
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
    if ($db) {
      fetchData($db);
    }
  });
</script>

<main class="p-8 bg-gray-50 dark:bg-gray-900">
  <!-- Page Header -->
  <section class="mx-auto my-12 max-w-7xl text-center">
    <h1 class="mb-6 text-5xl font-extrabold text-gray-800 dark:text-gray-100">
      Choose the Right Server for Your Needs
    </h1>
    <p class="text-lg mb-5 text-gray-600 dark:text-gray-400">
      Explore our curated server configurations tailored to different usage
      scenarios. Find the best options that fit your specific needs.
    </p>

    <div class="flex justify-center space-x-4 mb-5">
      <PriceControls />
    </div>
  </section>

  <!-- Configurations Sections -->
  <section class="mx-auto mb-10 max-w-7xl">
    <!-- Most Affordable Configurations -->
    <div class="mb-16">
      <h2 class="mb-4 text-3xl font-bold text-gray-800 dark:text-gray-100">
        Most Affordable Configurations
      </h2>
      <p class="mb-8 text-gray-600 dark:text-gray-400">
        Perfect for budget-conscious users looking to maximize value without
        compromising essential features.
      </p>
      <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {#if loading}
          <!-- Loading placeholders -->
          {#each Array(4) as _, i}
            <div
              class="relative flex flex-col justify-between min-h-[210px] bg-white dark:bg-gray-800 rounded-lg shadow-md p-4"
            >
              <div class="flex items-center justify-center h-full">
                <Spinner size="8" />
              </div>
            </div>
          {/each}
        {:else}
          {#each cheapestConfigurations.slice(0, 4) as config (config.cpu + "-" + config.ram_size + "-" + config.hdd_size + "-" + config.nvme_size + "-" + config.sata_size)}
            <ServerCard
              timeUnitPrice={$settingsStore.timeUnitPrice}
              {config}
              loading={false}
              displayStoragePrice={undefined}
              displayRamPrice={undefined}
            ></ServerCard>
          {/each}
        {/if}
      </div>
    </div>

    <!-- Best Value for Disk Space -->
    <div class="mb-16">
      <h2 class="mb-4 text-3xl font-bold text-gray-800 dark:text-gray-100">
        Best Value for Disk Space
      </h2>
      <p class="mb-8 text-gray-600 dark:text-gray-400">
        Ideal for data-intensive applications, backups, and storage-heavy
        projects requiring ample disk space.
      </p>
      <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {#if loading}
          <!-- Loading placeholders -->
          {#each Array(4) as _, i}
            <div
              class="relative flex flex-col justify-between min-h-[210px] bg-white dark:bg-gray-800 rounded-lg shadow-md p-4"
            >
              <div class="flex items-center justify-center h-full">
                <Spinner size="8" />
              </div>
            </div>
          {/each}
        {:else}
          {#each cheapDiskConfigurations.slice(0, 4) as config (config.cpu + "-" + config.ram_size + "-" + config.hdd_size + "-" + config.nvme_size + "-" + config.sata_size)}
            <ServerCard
              timeUnitPrice={$settingsStore.timeUnitPrice}
              {config}
              loading={false}
              displayStoragePrice="perTB"
              displayRamPrice={undefined}
            ></ServerCard>
          {/each}
        {/if}
      </div>
    </div>

    <!-- Best Value for Memory -->
    <div class="mb-16">
      <h2 class="mb-4 text-3xl font-bold text-gray-800 dark:text-gray-100">
        Best Value for Memory
      </h2>
      <p class="mb-8 text-gray-600 dark:text-gray-400">
        Optimize performance for memory-intensive applications such as
        databases, virtual machines, and high-traffic websites.
      </p>
      <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {#if loading}
          <!-- Loading placeholders -->
          {#each Array(4) as _, i}
            <div
              class="relative flex flex-col justify-between min-h-[210px] bg-white dark:bg-gray-800 rounded-lg shadow-md p-4"
            >
              <div class="flex items-center justify-center h-full">
                <Spinner size="8" />
              </div>
            </div>
          {/each}
        {:else}
          {#each cheapRamConfigurations.slice(0, 4) as config (config.cpu + "-" + config.ram_size + "-" + config.hdd_size + "-" + config.nvme_size + "-" + config.sata_size)}
            <ServerCard
              timeUnitPrice={$settingsStore.timeUnitPrice}
              {config}
              loading={false}
              displayRamPrice="perGB"
              displayStoragePrice={undefined}
            ></ServerCard>
          {/each}
        {/if}
      </div>
    </div>

    <!-- Cheapest NVMe Storage -->
    <div class="mb-16">
      <h2 class="mb-4 text-3xl font-bold text-gray-800 dark:text-gray-100">
        High-Performance NVMe Storage
      </h2>
      <p class="mb-8 text-gray-600 dark:text-gray-400">
        Maximize I/O with NVMe SSDs, perfect for databases, high-traffic sites,
        and latency-sensitive applications.
      </p>
      <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {#if loading}
          <!-- Loading placeholders -->
          {#each Array(4) as _, i}
            <div
              class="relative flex flex-col justify-between min-h-[210px] bg-white dark:bg-gray-800 rounded-lg shadow-md p-4"
            >
              <div class="flex items-center justify-center h-full">
                <Spinner size="8" />
              </div>
            </div>
          {/each}
        {:else}
          {#each cheapNvmeConfigurations.slice(0, 4) as config (config.cpu + "-" + config.ram_size + "-" + config.hdd_size + "-" + config.nvme_size + "-" + config.sata_size)}
            <ServerCard
              timeUnitPrice={$settingsStore.timeUnitPrice}
              {config}
              loading={false}
              displayStoragePrice="perTB"
              displayRamPrice={undefined}
            ></ServerCard>
          {/each}
        {/if}
      </div>
    </div>

    <!-- Cheapest SATA Storage -->
    <div class="mb-16">
      <h2 class="mb-4 text-3xl font-bold text-gray-800 dark:text-gray-100">
        Affordable SATA SSDs
      </h2>
      <p class="mb-8 text-gray-600 dark:text-gray-400">
        Affordable SATA SSDs balancing speed and cost for general storage, web
        hosting, and backups.
      </p>
      <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {#if loading}
          <!-- Loading placeholders -->
          {#each Array(4) as _, i}
            <div
              class="relative flex flex-col justify-between min-h-[210px] bg-white dark:bg-gray-800 rounded-lg shadow-md p-4"
            >
              <div class="flex items-center justify-center h-full">
                <Spinner size="8" />
              </div>
            </div>
          {/each}
        {:else}
          {#each cheapSataConfigurations.slice(0, 4) as config (config.cpu + "-" + config.ram_size + "-" + config.hdd_size + "-" + config.nvme_size + "-" + config.sata_size)}
            <ServerCard
              timeUnitPrice={$settingsStore.timeUnitPrice}
              {config}
              loading={false}
              displayStoragePrice="perTB"
              displayRamPrice={undefined}
            ></ServerCard>
          {/each}
        {/if}
      </div>
    </div>
  </section>

  <!-- Usage Scenarios Section -->
  <section class="mx-auto my-20 max-w-7xl">
    <h2
      class="mb-10 text-center text-4xl font-semibold text-gray-800 dark:text-gray-100"
    >
      Common Usage Scenarios
    </h2>
    <div class="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
      <!-- High-Memory Applications -->
      <div
        class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 flex flex-col items-center text-center"
      >
        <FontAwesomeIcon
          class="mb-4 text-orange-500"
          icon={faMemory}
          size="3x"
        />
        <h3 class="mb-4 text-2xl font-bold text-gray-800 dark:text-gray-100">
          High-Memory Applications
        </h3>
        <p class="text-gray-600 dark:text-gray-400">
          Perfect for running large databases, virtual machines, and
          applications that require substantial memory resources.
        </p>
      </div>

      <!-- Backup Solutions -->
      <div
        class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 flex flex-col items-center text-center"
      >
        <FontAwesomeIcon
          class="mb-4 text-orange-500"
          icon={faDatabase}
          size="3x"
        />
        <h3 class="mb-4 text-2xl font-bold text-gray-800 dark:text-gray-100">
          Backup Solutions
        </h3>
        <p class="text-gray-600 dark:text-gray-400">
          Ideal for storing backups and ensuring data redundancy, providing
          peace of mind for your critical information.
        </p>
      </div>

      <!-- Game Servers -->
      <div
        class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 flex flex-col items-center text-center"
      >
        <FontAwesomeIcon
          class="mb-4 text-orange-500"
          icon={faGamepad}
          size="3x"
        />
        <h3 class="mb-4 text-2xl font-bold text-gray-800 dark:text-gray-100">
          Game Servers
        </h3>
        <p class="text-gray-600 dark:text-gray-400">
          Host multiplayer game servers with low latency and reliable
          performance to ensure a smooth gaming experience.
        </p>
      </div>

      <!-- Additional Scenarios (Optional) -->
      <!-- You can add more scenarios as needed -->
      <div
        class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 flex flex-col items-center text-center"
      >
        <FontAwesomeIcon
          class="mb-4 text-orange-500"
          icon={faCloud}
          size="3x"
        />
        <h3 class="mb-4 text-2xl font-bold text-gray-800 dark:text-gray-100">
          Cloud Applications
        </h3>
        <p class="text-gray-600 dark:text-gray-400">
          Deploy scalable cloud applications that can handle varying workloads
          with ease and flexibility.
        </p>
      </div>

      <div
        class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 flex flex-col items-center text-center"
      >
        <FontAwesomeIcon
          class="mb-4 text-orange-500"
          icon={faShieldAlt}
          size="3x"
        />
        <h3 class="mb-4 text-2xl font-bold text-gray-800 dark:text-gray-100">
          Secure Hosting
        </h3>
        <p class="text-gray-600 dark:text-gray-400">
          Host your websites and applications with robust security measures to
          protect against threats and vulnerabilities.
        </p>
      </div>

      <div
        class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 flex flex-col items-center text-center"
      >
        <FontAwesomeIcon class="mb-4 text-orange-500" icon={faCode} size="3x" />
        <h3 class="mb-4 text-2xl font-bold text-gray-800 dark:text-gray-100">
          Development Environments
        </h3>
        <p class="text-gray-600 dark:text-gray-400">
          Set up reliable and customizable development environments to
          streamline your software development process.
        </p>
      </div>
    </div>
  </section>

  <!-- Call to Action -->
  <section class="mx-auto my-12 max-w-7xl text-center">
    <h2 class="mb-6 text-4xl font-extrabold text-gray-800 dark:text-gray-100">
      Ready to Explore More?
    </h2>
    <p class="text-lg text-gray-600 dark:text-gray-400 mb-10">
      Dive into our server configurations and find the perfect setup for your
      projects.
    </p>
    <div class="flex justify-center space-x-4">
      <Button
        color="primary"
        href="/analyze"
        class="px-8 py-3 text-lg shadow-sm">Analyze</Button
      >
    </div>
  </section>
</main>
