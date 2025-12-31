<script lang="ts">
	import { reloadDB } from '$lib/api/frontend/dbapi';
	import { faRefresh } from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import dayjs from 'dayjs';
	import { Alert, Button, Spinner } from 'flowbite-svelte';
	import { onDestroy } from 'svelte';
	import { db } from '../../stores/db';

	export let lastUpdate: number;
	export let threshold = 60 * 65; // in seconds

	let reloading = false;
	let showElement = false;
	let timer: ReturnType<typeof setTimeout> | null = null;

	$: if (lastUpdate) {
		const now = dayjs();
		const lastUpdateDate = dayjs(lastUpdate * 1000);
		console.log('last update', lastUpdateDate);
		const elapsedSeconds = now.diff(lastUpdateDate, 'second');
		console.log('elapsed seconds', elapsedSeconds);
		const remainingTime = threshold - elapsedSeconds;
		console.log('remaining time', remainingTime);

		if (elapsedSeconds >= threshold) {
			showElement = true;
		} else {
			if (timer !== null) {
				clearTimeout(timer);
			}
			if (remainingTime > 0) {
				/* eslint-disable svelte/infinite-reactive-loop -- Timer and showElement updates are guarded by conditional checks */
				timer = setTimeout(() => {
					showElement = true;
					timer = null;
				}, remainingTime * 1000);
				/* eslint-enable svelte/infinite-reactive-loop */
			} else {
				showElement = true;
			}
		}
	}

	onDestroy(() => {
		if (timer !== null) {
			clearTimeout(timer);
		}
	});
</script>

{#if showElement}
	<Alert
		class="rounded-none border-x border-b border-gray-200 border-x-orange-200 py-5 text-center dark:border-gray-700 dark:border-x-orange-800"
	>
		<p class="pb-3 text-gray-700 dark:text-gray-300">Newer data is available.</p>
		<Button
			color="primary"
			size="xs"
			disabled={reloading}
			on:click={async () => {
				reloading = true;
				if ($db) {
					await reloadDB($db);
					$db = $db;
				}
				showElement = false;
				reloading = false;
			}}
		>
			{#if reloading}
				<Spinner size="4" class="me-2" />
			{:else}
				<FontAwesomeIcon icon={faRefresh} class="me-2 h-4 w-4" />
			{/if}
			Refresh Database</Button
		>
	</Alert>
{/if}
