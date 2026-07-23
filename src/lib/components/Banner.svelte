<script lang="ts">
	import { Banner } from 'flowbite-svelte';
	import { BullhornSolid } from 'flowbite-svelte-icons';
	import { settingsStore } from '$lib/stores/settings';
	import { onMount, type Snippet } from 'svelte';
	import { get } from 'svelte/store';

	let {
		id = 'default',
		version = 1,
		children
	}: { id?: string; version?: string | number; children?: Snippet } = $props();

	// Server-render the banner visible so it never pops in after hydration (CLS).
	// Users who dismissed this exact version get it hidden pre-paint by the
	// inline script in app.html, which targets the version-encoded element id.
	const domId = $derived(`banner-${id}-v${version}`);
	let bannerStatus: boolean = $state(true);
	let initialized: boolean = $state(false);

	onMount(() => {
		const settings = get(settingsStore);
		const dismissedVersion = settings[`sr-banner-closed-${id}`];

		// Remove the banner from the DOM if this exact version was dismissed
		// (visually it is already hidden by the pre-paint style).
		bannerStatus = dismissedVersion === undefined || dismissedVersion !== version;

		initialized = true;
	});

	$effect(() => {
		if (initialized && !bannerStatus) {
			// Store the version that was dismissed
			settingsStore.updateSetting(`sr-banner-closed-${id}`, version);
		}
	});
</script>

<Banner
	bind:open={bannerStatus}
	id={domId}
	class="relative z-10 flex items-center justify-between bg-gray-100 px-2 py-1 dark:border-gray-600 dark:bg-gray-700"
	closeClass="p-1"
>
	<p class="flex items-center text-sm font-normal text-gray-500 dark:text-gray-400">
		<span class="me-3 inline-flex rounded-full bg-gray-200 p-1 dark:bg-gray-600">
			<BullhornSolid class="h-3 w-3 text-orange-500 dark:text-gray-400" />
			<span class="sr-only">Notification Icon</span>
		</span>
		<span>
			{@render children?.()}
		</span>
	</p>
</Banner>
