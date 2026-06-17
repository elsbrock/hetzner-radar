<script lang="ts">
	import { Button } from 'flowbite-svelte';
	import type { IconDefinition } from '@fortawesome/fontawesome-common-types';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome'; // Use named import
	import { fly } from 'svelte/transition';
	import { onDestroy } from 'svelte';
	import { fabSlots, registerFab, unregisterFab } from '$lib/stores/fabStore';

	let {
		icon,
		targetSelector = null,
		onClick = null,
		visible,
		priority,
		ariaLabel
	}: {
		icon: IconDefinition;
		targetSelector?: string | null;
		onClick?: (() => void) | null;
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

	// This instance's vertical slot (0 = bottom-most). Undefined while unregistered.
	let slot = $derived($fabSlots.get(fabId));

	// Render whenever this FAB is visible and has been assigned a slot.
	let shouldRender = $derived(visible && slot !== undefined);

	// Vertical offset: slot 0 sits at the original bottom-12 (3rem); each higher
	// slot stacks upward by 4.5rem.
	let bottomStyle = $derived(`bottom: calc(3rem + ${slot ?? 0} * 4.5rem)`);

	function handleClick() {
		if (onClick) {
			onClick();
			return;
		}
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
	<div class="fixed right-6 z-50" style={bottomStyle} transition:fly={{ y: 100, duration: 300 }}>
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
