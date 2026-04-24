<script lang="ts">
  import {
    getConfigurationsByCategory,
    getConfigurationsMeta,
    type ConfigurationsByCategory,
  } from "$lib/api/frontend/configs";
  import { withDbConnections } from "$lib/api/frontend/dbapi";
  import { type ServerConfiguration } from "$lib/api/frontend/filter";
  import {
    CONFIGURATION_CATEGORIES,
    type ConfigurationCategory,
    type ConfigurationCategoryId,
  } from "$lib/api/shared/configurations";
  import PriceControls from "$lib/components/PriceControls.svelte";
  import ServerCard from "$lib/components/ServerCard.svelte";
  import Spinner from "flowbite-svelte/Spinner.svelte";
  import { defaultFilter, encodeFilter } from "$lib/filter";

  import { settingsStore } from "$lib/stores/settings";
  import type { AsyncDuckDB } from "@duckdb/duckdb-wasm";
  import {
    faArchive,
    faArrowRight,
    faBolt,
    faChartLine,
    faMemory,
    faMicrochip,
    faServer,
  } from "@fortawesome/free-solid-svg-icons";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { Button } from "flowbite-svelte";
  import dayjs from "dayjs";
  import relativeTime from "dayjs/plugin/relativeTime";
  import { db } from "../../stores/db";

  dayjs.extend(relativeTime);

  let { data } = $props();

  const iconMap = {
    chart: faChartLine,
    server: faServer,
    cpu: faMicrochip,
    memory: faMemory,
    flash: faBolt,
    archive: faArchive,
  } as const;

  let selectedTimeUnit = $derived(
    ($settingsStore.timeUnitPrice ?? "perMonth") as "perMonth" | "perHour",
  );

  function emptyCategories(): ConfigurationsByCategory {
    return Object.fromEntries(
      CONFIGURATION_CATEGORIES.map((c) => [c.id, []]),
    ) as unknown as ConfigurationsByCategory;
  }

  const hasServerData = $derived(
    Object.values(data.categories ?? {}).some(
      (list) => list && list.length > 0,
    ),
  );

  let duckDbCategories: ConfigurationsByCategory = $state(emptyCategories());
  let duckDbLastUpdatedAt: number | null = $state(null);
  let duckDbGpuCount: number = $state(0);
  let loadingDuckDb = $state(false);

  const categories = $derived<ConfigurationsByCategory>(
    hasServerData
      ? (data.categories as ConfigurationsByCategory)
      : duckDbCategories,
  );
  const lastUpdatedAt = $derived<number | null>(
    hasServerData ? data.lastUpdatedAt : duckDbLastUpdatedAt,
  );
  const gpuServerCount = $derived<number>(
    hasServerData ? data.gpuServerCount : duckDbGpuCount,
  );

  const loading = $derived(!hasServerData && (loadingDuckDb || !$db));

  async function fetchFromDuckDB(database: AsyncDuckDB) {
    loadingDuckDb = true;

    await withDbConnections(database, async (conn) => {
      try {
        const [cats, meta] = await Promise.all([
          getConfigurationsByCategory(conn),
          getConfigurationsMeta(conn),
        ]);
        duckDbCategories = cats;
        duckDbLastUpdatedAt = meta.lastUpdatedAt;
        duckDbGpuCount = meta.gpuServerCount;
      } catch (error) {
        console.error("Error fetching data from DuckDB:", error);
      } finally {
        loadingDuckDb = false;
      }
    });
  }

  $effect(() => {
    if (!hasServerData && $db) {
      fetchFromDuckDB($db);
    }
  });

  function cardKey(config: ServerConfiguration, fallbackIndex: number): string {
    return `${config.cpu}-${config.ram_size}-${config.hdd_size}-${config.nvme_size}-${config.sata_size}-${fallbackIndex}`;
  }

  function categoryServers(id: ConfigurationCategoryId): ServerConfiguration[] {
    return categories[id] ?? [];
  }

  const gpuFilterUrl = $derived.by(() => {
    const filter = { ...defaultFilter, extrasGPU: true };
    return `/analyze?filter=${encodeFilter(filter)}`;
  });

  function displayProps(category: ConfigurationCategory) {
    return {
      displayStoragePrice: category.displayStoragePrice,
      displayRamPrice: category.displayRamPrice,
    };
  }

  const CANONICAL_URL = "https://radar.iodev.org/configurations";
  const PAGE_TITLE = "Best Hetzner Dedicated Server Deals — Server Radar";
  const PAGE_DESCRIPTION =
    "Live rankings of the best Hetzner dedicated server auctions: best price-per-performance, plus cheapest per core, per GB RAM, NVMe, and bulk storage.";

  function formatStorage(gb: number): string {
    if (gb >= 1000) {
      const tb = gb / 1000;
      return `${tb % 1 === 0 ? tb.toFixed(0) : tb.toFixed(1)} TB`;
    }
    return `${gb} GB`;
  }

  function describeServer(config: ServerConfiguration): string {
    const parts: string[] = [];
    parts.push(`${config.ram_size} GB${config.is_ecc ? " ECC" : ""} RAM`);
    if (config.nvme_size && config.nvme_size > 0) {
      parts.push(`${formatStorage(config.nvme_size)} NVMe`);
    }
    if (config.sata_size && config.sata_size > 0) {
      parts.push(`${formatStorage(config.sata_size)} SATA`);
    }
    if (config.hdd_size && config.hdd_size > 0) {
      parts.push(`${formatStorage(config.hdd_size)} HDD`);
    }
    if (config.with_gpu) parts.push("GPU");
    if (config.with_inic) parts.push("iNIC");
    if (config.with_hwr) parts.push("hardware RAID");
    if (config.with_rps) parts.push("redundant PSU");
    return parts.join(", ");
  }

  function jsonLdSafe(value: unknown): string {
    return JSON.stringify(value).replace(/</g, "\\u003c");
  }

  const breadcrumbJsonLd = $derived({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://radar.iodev.org/",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Configurations",
        item: CANONICAL_URL,
      },
    ],
  });

  const itemListsJsonLd = $derived(
    CONFIGURATION_CATEGORIES.map((category) => {
      const servers = categoryServers(category.id);
      if (servers.length === 0) return null;
      return {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: category.title,
        description: category.tagline,
        url: `${CANONICAL_URL}#${category.anchor}`,
        numberOfItems: servers.length,
        itemListElement: servers.map((config, index) => ({
          "@type": "ListItem",
          position: index + 1,
          item: {
            "@type": "Product",
            name: config.cpu,
            description: describeServer(config),
            category: "Dedicated Server",
            brand: {
              "@type": "Organization",
              name: "Hetzner",
            },
            offers: {
              "@type": "Offer",
              priceCurrency: "EUR",
              price:
                typeof config.price === "number"
                  ? config.price.toFixed(2)
                  : undefined,
              availability: "https://schema.org/InStock",
              url: CANONICAL_URL,
            },
          },
        })),
      };
    }).filter((entry): entry is NonNullable<typeof entry> => entry !== null),
  );
</script>

<svelte:head>
  <title>{PAGE_TITLE}</title>
  <meta name="description" content={PAGE_DESCRIPTION} />
  <link rel="canonical" href={CANONICAL_URL} />

  <meta property="og:title" content={PAGE_TITLE} />
  <meta property="og:description" content={PAGE_DESCRIPTION} />
  <meta property="og:url" content={CANONICAL_URL} />
  <meta property="og:type" content="website" />
  <meta
    property="og:image"
    content="https://radar.iodev.org/images/og-image.webp"
  />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={PAGE_TITLE} />
  <meta name="twitter:description" content={PAGE_DESCRIPTION} />
  <meta
    name="twitter:image"
    content="https://radar.iodev.org/images/og-image.webp"
  />

  {@html `<script type="application/ld+json">${jsonLdSafe(breadcrumbJsonLd)}<` +
    `/script>`}
  {#each itemListsJsonLd as listSchema (listSchema.name)}
    {@html `<script type="application/ld+json">${jsonLdSafe(listSchema)}<` +
      `/script>`}
  {/each}
</svelte:head>

<main class="p-8">
  <!-- Page Header -->
  <section class="mx-auto my-12 max-w-7xl text-center">
    <h1 class="mb-6 text-5xl font-extrabold text-gray-800 dark:text-gray-100">
      Choose the Right Server for Your Needs
    </h1>
    <p class="mb-5 text-lg text-gray-600 dark:text-gray-400">
      Explore our curated server configurations tailored to different usage
      scenarios. Find the best options that fit your specific needs.
    </p>

    {#if lastUpdatedAt}
      <p class="mb-5 text-sm text-gray-500 dark:text-gray-400">
        Snapshot updated {dayjs.unix(lastUpdatedAt).fromNow()}
      </p>
    {/if}

    <div class="mb-5 flex justify-center space-x-4">
      <PriceControls />
    </div>
  </section>

  <!-- Configurations Sections -->
  <section class="mx-auto mb-10 max-w-7xl">
    {#each CONFIGURATION_CATEGORIES as category (category.id)}
      <div class="mb-16" id={category.anchor}>
        <h2 class="mb-4 text-3xl font-bold text-gray-800 dark:text-gray-100">
          <FontAwesomeIcon
            icon={iconMap[category.iconKey]}
            class="mr-3 text-orange-500"
          />
          {category.title}
        </h2>
        <p class="mb-8 text-gray-600 dark:text-gray-400">
          {category.tagline}
        </p>
        <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {#if loading}
            {#each Array(4) as _, i (i)}
              <div
                class="relative flex min-h-[210px] flex-col justify-between rounded-lg bg-white p-4 shadow-md dark:bg-gray-800"
              >
                <div class="flex h-full items-center justify-center">
                  <Spinner size="8" />
                </div>
              </div>
            {/each}
          {:else if categoryServers(category.id).length === 0}
            <div
              class="col-span-full rounded-lg border border-dashed border-gray-200 bg-white/50 p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-400"
            >
              No matching configurations in the current snapshot.
            </div>
          {:else}
            {#each categoryServers(category.id) as config, i (cardKey(config, i))}
              <ServerCard
                timeUnitPrice={selectedTimeUnit}
                {config}
                loading={false}
                {...displayProps(category)}
              />
            {/each}
          {/if}
        </div>
      </div>
    {/each}

    {#if gpuServerCount > 0}
      <div class="mt-4 flex justify-center">
        <a
          href={gpuFilterUrl}
          class="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm transition hover:border-orange-300 hover:bg-orange-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-orange-600 dark:hover:bg-orange-900/20"
        >
          <FontAwesomeIcon icon={faBolt} class="text-orange-500" />
          {gpuServerCount} GPU server{gpuServerCount === 1 ? "" : "s"} available
          <FontAwesomeIcon icon={faArrowRight} class="h-3 w-3" />
        </a>
      </div>
    {/if}
  </section>

  <!-- Internal links -->
  <section class="mx-auto my-20 max-w-7xl">
    <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
      <a
        href="/servers/cpu"
        class="group flex flex-col rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:border-orange-300 hover:bg-orange-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-orange-600 dark:hover:bg-orange-900/20"
      >
        <div class="mb-3 flex items-center gap-3">
          <FontAwesomeIcon
            icon={faMicrochip}
            class="text-orange-500"
            size="lg"
          />
          <h3 class="text-xl font-semibold text-gray-800 dark:text-gray-100">
            Browse by CPU
          </h3>
        </div>
        <p class="mb-3 text-gray-600 dark:text-gray-400">
          Per-CPU pages with current cheapest price, common configurations, and
          90-day price history.
        </p>
        <span
          class="mt-auto inline-flex items-center gap-1 text-sm font-medium text-orange-600 group-hover:text-orange-700 dark:text-orange-400 dark:group-hover:text-orange-300"
        >
          Open /servers/cpu
          <FontAwesomeIcon icon={faArrowRight} class="h-3 w-3" />
        </span>
      </a>

      <a
        href="/statistics"
        class="group flex flex-col rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:border-orange-300 hover:bg-orange-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-orange-600 dark:hover:bg-orange-900/20"
      >
        <div class="mb-3 flex items-center gap-3">
          <FontAwesomeIcon
            icon={faChartLine}
            class="text-orange-500"
            size="lg"
          />
          <h3 class="text-xl font-semibold text-gray-800 dark:text-gray-100">
            Recent price trends
          </h3>
        </div>
        <p class="mb-3 text-gray-600 dark:text-gray-400">
          See how RAM, NVMe, and per-core prices have moved over the last three
          months.
        </p>
        <span
          class="mt-auto inline-flex items-center gap-1 text-sm font-medium text-orange-600 group-hover:text-orange-700 dark:text-orange-400 dark:group-hover:text-orange-300"
        >
          Open /statistics
          <FontAwesomeIcon icon={faArrowRight} class="h-3 w-3" />
        </span>
      </a>

      <a
        href="/cloud-status"
        class="group flex flex-col rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:border-orange-300 hover:bg-orange-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-orange-600 dark:hover:bg-orange-900/20"
      >
        <div class="mb-3 flex items-center gap-3">
          <FontAwesomeIcon icon={faServer} class="text-orange-500" size="lg" />
          <h3 class="text-xl font-semibold text-gray-800 dark:text-gray-100">
            Cloud server availability
          </h3>
        </div>
        <p class="mb-3 text-gray-600 dark:text-gray-400">
          Check live Hetzner Cloud stock per server type and location, with
          availability history.
        </p>
        <span
          class="mt-auto inline-flex items-center gap-1 text-sm font-medium text-orange-600 group-hover:text-orange-700 dark:text-orange-400 dark:group-hover:text-orange-300"
        >
          Open /cloud-status
          <FontAwesomeIcon icon={faArrowRight} class="h-3 w-3" />
        </span>
      </a>
    </div>
  </section>

  <!-- Call to Action -->
  <section class="mx-auto my-12 max-w-7xl text-center">
    <h2 class="mb-6 text-4xl font-extrabold text-gray-800 dark:text-gray-100">
      Browse all live auctions
    </h2>
    <p class="mb-10 text-lg text-gray-600 dark:text-gray-400">
      Apply your own filters across the full set of current Hetzner auctions and
      standard servers.
    </p>
    <div class="flex justify-center space-x-4">
      <Button
        color="primary"
        href="/analyze"
        class="px-8 py-3 text-lg shadow-xs"
      >
        Open the analyzer
        <FontAwesomeIcon icon={faArrowRight} class="ml-2 h-4 w-4" />
      </Button>
    </div>
  </section>
</main>
