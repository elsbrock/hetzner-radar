<script lang="ts">
	import { Button } from 'flowbite-svelte';
	import type { IconDefinition } from '@fortawesome/fontawesome-common-types';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome'; // Use named import
	import { fly } from 'svelte/transition';
	import { onDestroy } from 'svelte';
	import { activeFabId, registerFab, unregisterFab } from '$lib/stores/fabStore';

	let {
		icon,
		targetSelector = null,
		visible,
		priority,
		ariaLabel
	}: {
		icon: IconDefinition;
		targetSelector?: string | null;
		visible: boolean;
		priority: number;
		ariaLabel: string;
	} = $props();

	// Unique identifier for this FAB instance
	const fabId = Symbol('fabId');

	// Register/unregister based on visibility changes
	$effect(() => {
		if (visible) {
			registerFab(fabId, priority);
		} else {
			// Ensure unregistration if visibility changes back to false
			unregisterFab(fabId);
		}
	});

	// Ensure unregistration when the component is destroyed
	onDestroy(() => {
		unregisterFab(fabId);
	});

	// Determine if this specific FAB should be rendered based on priority
	let shouldRender = $derived(visible && $activeFabId === fabId);

	function handleClick() {
		if (targetSelector) {
			const targetElement = document.querySelector(targetSelector);
			if (targetElement) {
				targetElement.scrollIntoView({ behavior: 'smooth' });
			} else {
				console.warn(`FloatingActionButton: Target element "${targetSelector}" not found.`);
				window.scrollTo({ top: 0, behavior: 'smooth' }); // Fallback to top
			}
		} else {
			window.scrollTo({ top: 0, behavior: 'smooth' });
		}
	}
</script>

{#if shouldRender}
	<div class="fixed right-6 bottom-12 z-50" transition:fly={{ y: 100, duration: 300 }}>
		<Button
			onclick={handleClick}
			size="lg"
			class="rounded-full p-3! shadow-lg"
			aria-label={ariaLabel}
			color="primary"
		>
			<FontAwesomeIcon {icon} class="h-5 w-5 text-white" />
		</Button>
	</div>
{/if}
