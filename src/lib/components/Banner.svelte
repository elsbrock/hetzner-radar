<script lang="ts">
	import { Banner } from 'flowbite-svelte';
	import { BullhornSolid, CloseOutline } from 'flowbite-svelte-icons';
	import { settingsStore } from '$lib/stores/settings';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';

	export let id: string = 'default';
	export let version: string | number = 1;
	let bannerStatus: boolean = false;
	let initialized: boolean = false;

	onMount(() => {
		const settings = get(settingsStore);
		const dismissedVersion = settings[`sr-banner-closed-${id}`];

		if (dismissedVersion === undefined || dismissedVersion !== version) {
			bannerStatus = true;
		} else {
			bannerStatus = false;
		}

		initialized = true;
	});

	$: if (initialized && !bannerStatus) {
		settingsStore.updateSetting(`sr-banner-closed-${id}`, version);
	}
</script>

<Banner
	bind:bannerStatus
	{id}
	class="z-10 flex items-center justify-between border-b border-primary-200/50 bg-gradient-to-r from-primary-50 via-primary-50/80 to-primary-50 px-4 py-2.5 dark:border-primary-900/30 dark:from-primary-900/40 dark:via-primary-900/30 dark:to-primary-900/40"
	position="relative"
>
	<p class="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
		<span class="flex h-6 w-6 items-center justify-center rounded-md bg-primary-500/10 dark:bg-primary-400/10">
			<BullhornSolid class="h-3.5 w-3.5 text-primary-600 dark:text-primary-400" />
		</span>
		<span class="font-medium">
			<slot />
		</span>
	</p>
</Banner>
