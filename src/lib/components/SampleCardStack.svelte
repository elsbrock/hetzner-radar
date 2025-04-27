<script lang="ts">
  import type { ServerConfiguration } from '$lib/api/frontend/filter';
  import ServerCard from '$lib/components/ServerCard.svelte';

  // Sample configuration data (originally in +page.svelte)
  const sampleServerConfig: ServerConfiguration = {
    cpu: 'Intel Core i7-8700',
    ram_size: 16, // GB
    is_ecc: false,
    hdd_arr: ['1 x 1TB NVMe SSD'],
    nvme_size: 1000,
    nvme_drives: [1000],
    sata_size: null,
    sata_drives: [],
    hdd_size: null,
    hdd_drives: [],
    price: 49.99,
    min_price: 45.00,
    last_price: 49.99,
    markup_percentage: 5.5,
    last_seen: Math.floor(Date.now() / 1000),
    count: 25,
    with_hwr: false,
    with_gpu: true,
    with_rps: false,
    with_inic: false,
    ram: [],
  };

  const sampleConfigs: ServerConfiguration[] = [
    sampleServerConfig,
    {
      cpu: 'AMD Ryzen 5 5600X',
      ram_size: 32,
      is_ecc: false,
      hdd_arr: ['2 x 2TB SATA SSD'],
      nvme_size: null,
      nvme_drives: [],
      sata_size: 4000,
      sata_drives: [2000, 2000],
      hdd_size: null,
      hdd_drives: [],
      price: 55.50,
      min_price: 52.00,
      last_price: 55.50,
      markup_percentage: 6.0,
      last_seen: Math.floor(Date.now() / 1000) - 3600,
      count: 15,
      with_hwr: false,
      with_gpu: false,
      with_rps: true,
      with_inic: false,
      ram: [],
    },
    {
      cpu: 'Intel Xeon E-2336',
      ram_size: 64,
      is_ecc: true,
      hdd_arr: ['2 x 4TB HDD'],
      nvme_size: null,
      nvme_drives: [],
      sata_size: null,
      sata_drives: [],
      hdd_size: 8000,
      hdd_drives: [4000, 4000],
      price: 62.00,
      min_price: 60.00,
      last_price: 62.00,
      markup_percentage: 4.8,
      last_seen: Math.floor(Date.now() / 1000) - 7200,
      count: 8,
      with_hwr: false,
      with_gpu: false,
      with_rps: false,
      with_inic: true,
      ram: [],
    },
  ];

  // Card Stack Animation Logic
  const CYCLE_INTERVAL = 3000; // ms between card cycles
  const MAX_VISIBLE_DISTANCE = 2; // How many cards behind the active one are visible (0 = active, 1 = next, 2 = next+1)
  const OFFSET_INCREMENT_REM = 1.0; // Offset increment per card distance (down and right)
  const BASE_Z_INDEX = 20; // z-index of the active card
  const Z_INDEX_DECREMENT = 10; // How much z-index decreases per card distance
  const BASE_SCALE = 1.0; // Scale of the active card
  const SCALE_DECREMENT = 0.05;
  const BASE_OPACITY = 1.0;
  const OPACITY_DECREMENT = 0.25;
  const HIDDEN_SCALE = 0.85;
  const HIDDEN_OPACITY = 0;

  let activeCardIndex = $state(0);

  $effect(() => {
    const intervalId = setInterval(() => {
      activeCardIndex = (activeCardIndex + 1) % sampleConfigs.length;
    }, CYCLE_INTERVAL);

    return () => {
      clearInterval(intervalId);
    };
  });
</script>

<div class="relative mb-10 max-w-xs mx-auto min-h-[12rem]"> <!-- Container for the stack, added min-h -->
  {#each sampleConfigs as config, index}
    {@const distance = (index - activeCardIndex + sampleConfigs.length) % sampleConfigs.length}
    {@const isVisible = distance <= MAX_VISIBLE_DISTANCE}

    {@const topRem = isVisible ? -distance * OFFSET_INCREMENT_REM : 0}
    {@const leftRem = isVisible ? distance * OFFSET_INCREMENT_REM : 0}
    {@const zIndex = isVisible ? BASE_Z_INDEX - distance * Z_INDEX_DECREMENT : -10}
    {@const scale = isVisible ? BASE_SCALE - distance * SCALE_DECREMENT : HIDDEN_SCALE}
    {@const opacity = isVisible ? BASE_OPACITY - distance * OPACITY_DECREMENT : HIDDEN_OPACITY}

    <div
      class="absolute w-full transition-all duration-500 ease-in-out"
      style:top="{topRem}rem"
      style:left="{leftRem}rem"
      style:z-index={zIndex}
      style:transform="scale({scale})"
      style:opacity={opacity}
    >
      <ServerCard {config} displayStoragePrice={undefined} displayRamPrice={undefined} timeUnitPrice="perMonth" />
    </div>
  {/each}
</div>