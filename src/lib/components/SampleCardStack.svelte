<script lang="ts">
  import type { ServerConfiguration } from '$lib/api/frontend/filter';
  import ServerCard from '$lib/components/ServerCard.svelte';

  // Sample configuration data based on real examples
  const sampleConfigs: ServerConfiguration[] = [
    {
      cpu: 'Intel Core i7-7700',
      ram_size: 64, // GB
      is_ecc: false,
      hdd_arr: ['2 x 2TB HDD'],
      nvme_size: null,
      nvme_drives: [],
      sata_size: null,
      sata_drives: [],
      hdd_size: 4000, // 2 * 2TB
      hdd_drives: [2000, 2000],
      price: 37.72, // Assuming net price for simplicity in sample
      min_price: 37.72,
      last_price: 37.72,
      markup_percentage: 0, // Best price
      last_seen: Math.floor(Date.now() / 1000) - 22 * 60, // Approx 22 mins ago
      count: 1, // Placeholder count
      with_hwr: false, // Assuming no hardware RAID
      with_gpu: false, // Assuming no GPU
      with_rps: false, // Assuming no redundant power supply
      with_inic: true, // Has Intel NIC
      ram: [], // Placeholder
    },
    {
      cpu: 'AMD Ryzen 5 3600',
      ram_size: 64,
      is_ecc: true,
      hdd_arr: ['2 x 6TB HDD'],
      nvme_size: null,
      nvme_drives: [],
      sata_size: null,
      sata_drives: [],
      hdd_size: 12000, // 2 * 6TB
      hdd_drives: [6000, 6000],
      price: 44.86, // Assuming net price
      min_price: 44.86,
      last_price: 44.86,
      markup_percentage: 0, // Best price
      last_seen: Math.floor(Date.now() / 1000) - 22 * 60,
      count: 1,
      with_hwr: false,
      with_gpu: false,
      with_rps: false,
      with_inic: false, // Assuming no Intel NIC
      ram: [],
    },
    {
      cpu: 'Intel Xeon E3-1275v6',
      ram_size: 64,
      is_ecc: true, // Has ECC
      hdd_arr: ['2 x 4TB HDD'],
      nvme_size: null,
      nvme_drives: [],
      sata_size: null,
      sata_drives: [],
      hdd_size: 8000, // 2 * 4TB
      hdd_drives: [4000, 4000],
      price: 48.43, // Assuming net price
      min_price: 43.63, // Calculated approx best price (48.43 / 1.11)
      last_price: 48.43,
      markup_percentage: 11, // 11% higher than best
      last_seen: Math.floor(Date.now() / 1000) - 22 * 60,
      count: 1,
      with_hwr: false,
      with_gpu: false,
      with_rps: false,
      with_inic: true, // Has Intel NIC
      ram: [],
    },
  ];

  // Card Stack Animation Logic
  const CYCLE_INTERVAL = 3000; // ms between card cycles
  const MAX_VISIBLE_DISTANCE = 2; // How many cards behind the active one are visible (0 = active, 1 = next, 2 = next+1)
  const OFFSET_INCREMENT_REM = 1.5; // Offset increment per card distance (down and right)
  const BASE_Z_INDEX = 20; // z-index of the active card
  const Z_INDEX_DECREMENT = 10; // How much z-index decreases per card distance
  const BASE_SCALE = 1.0; // Scale of the active card
  const SCALE_DECREMENT = 0.05;
  const BASE_OPACITY = 1.0;
  const OPACITY_DECREMENT = 0;
  const HIDDEN_SCALE = 0.85;
  const HIDDEN_OPACITY = 0;

  let activeCardIndex = $state(0);
  let isHovering = $state(false);
  let intervalId: ReturnType<typeof setInterval> | null = null;

  // Function to start the animation
  function startAnimation() {
    if (!intervalId) {
      intervalId = setInterval(() => {
        activeCardIndex = (activeCardIndex + 1) % sampleConfigs.length;
      }, CYCLE_INTERVAL);
    }
  }

  // Function to stop the animation
  function stopAnimation() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  // Start animation on component mount
  $effect(() => {
    startAnimation();
    
    return () => {
      stopAnimation();
    };
  });

  // Handle hover state changes
  function handleMouseEnter() {
    isHovering = true;
    stopAnimation();
  }

  function handleMouseLeave() {
    isHovering = false;
    startAnimation();
  }
</script>

<div
  class="relative max-w-xs mx-auto min-h-[12rem]"
  onmouseenter={handleMouseEnter}
  onmouseleave={handleMouseLeave}
> <!-- Container for the stack -->
  {#each sampleConfigs as config, index}
    {@const distance = (index - activeCardIndex + sampleConfigs.length) % sampleConfigs.length}
    {@const isVisible = distance <= MAX_VISIBLE_DISTANCE}

    {@const topRem = isVisible ? -distance * OFFSET_INCREMENT_REM : 0}
    {@const leftRem = isVisible ? distance * OFFSET_INCREMENT_REM : 0}
    {@const zIndex = isVisible ? BASE_Z_INDEX - distance * Z_INDEX_DECREMENT : -10}
    {@const scale = isVisible
      ? (distance === 0 && isHovering
          ? BASE_SCALE + 0.05 // Slightly larger when hovering on top card
          : BASE_SCALE - distance * SCALE_DECREMENT)
      : HIDDEN_SCALE}
    {@const opacity = isVisible ? BASE_OPACITY - distance * OPACITY_DECREMENT : HIDDEN_OPACITY}

    <div
      class="absolute w-full transition-all duration-500 ease-in-out"
      style:top="{topRem}rem"
      style:left="{leftRem}rem"
      style:z-index={zIndex}
      style:transform="scale({scale})"
      style:opacity={opacity}
    >
      <ServerCard {config} displayStoragePrice={undefined} displayRamPrice={undefined} timeUnitPrice="perMonth" clickable={false} />
    </div>
  {/each}
</div>