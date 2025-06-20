<script lang="ts">
	import { Banner } from 'flowbite-svelte';
	import { BullhornSolid } from 'flowbite-svelte-icons';
	import { settingsStore } from '$lib/stores/settings';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';

	export let id: string = 'default';
	export let version: string | number = 1; // Add version prop
	let bannerStatus: boolean = false;
	let initialized: boolean = false;

	onMount(() => {
		const settings = get(settingsStore);
		const dismissedVersion = settings[`sr-banner-closed-${id}`];

		// Show banner if no version dismissed OR if dismissed version is different from current version
		if (dismissedVersion === undefined || dismissedVersion !== version) {
			bannerStatus = true;
		} else {
			bannerStatus = false; // Hide banner if the current version was already dismissed
		}

		initialized = true;
	});

	$: if (initialized && !bannerStatus) {
		// Store the version that was dismissed
		settingsStore.updateSetting(`sr-banner-closed-${id}`, version);
	}
</script>

<Banner
	bind:bannerStatus
	{id}
	class="z-10 flex justify-between bg-gray-100 p-2 dark:border-gray-600 dark:bg-gray-700"
	position="relative"
>
	<p class="flex items-center text-sm font-normal text-gray-500 dark:text-gray-400">
		<span class="me-3 inline-flex rounded-full bg-gray-200 p-1 dark:bg-gray-600">
			<BullhornSolid class="h-3 w-3 text-orange-500 dark:text-gray-400" />
			<span class="sr-only">Notification Icon</span>
		</span>
		<span>
			<slot />
		</span>
	</p>
</Banner>
