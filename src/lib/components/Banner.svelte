<script lang="ts">
  import { Banner } from "flowbite-svelte";
  import { BullhornSolid } from "flowbite-svelte-icons";
  import { settingsStore } from "$lib/stores/settings";
  import { onMount } from "svelte";
  import { get } from "svelte/store";

  export let id: string = "default";
  let bannerStatus: boolean = false;
  let initialized: boolean = false;

  onMount(() => {
    const settings = get(settingsStore);
    const setting = settings[`sr-banner-closed-${id}`];
    console.log("Setting", setting);

    if (setting) {
      bannerStatus = false; // Hide banner if setting exists
    } else {
      bannerStatus = true; // Show banner if no setting
    }

    initialized = true;
  });

  $: if (initialized && !bannerStatus) {
    console.log("Banner closed, updating store");
    settingsStore.updateSetting(`sr-banner-closed-${id}`, true);
  }
</script>

<Banner
  bind:bannerStatus
  {id}
  class="z-10 flex justify-between p-2 bg-gray-100 dark:bg-gray-700 dark:border-gray-600"
  position="relative"
>
  <p
    class="flex items-center text-sm font-normal text-gray-500 dark:text-gray-400"
  >
    <span
      class="inline-flex p-1 me-3 bg-gray-200 rounded-full dark:bg-gray-600"
    >
      <BullhornSolid class="w-3 h-3 text-orange-500 dark:text-gray-400" />
      <span class="sr-only">Notification Icon</span>
    </span>
    <span>
      <slot />
    </span>
  </p>
</Banner>
