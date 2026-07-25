<script lang="ts">
	import { enhance } from '$app/forms';
	import { faPlug, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { Alert, Button } from 'flowbite-svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData | undefined } = $props();

	let submitting = $state(false);

	// Approving or denying both end at a URL Better Auth returns, which is the
	// requesting application's callback — outside this app, so it needs a real
	// navigation rather than client-side routing.
	function handleResult(result: { type: string; data?: Record<string, unknown> }) {
		submitting = false;
		const target = result.type === 'success' ? (result.data?.redirectTo as string) : undefined;
		if (target) window.location.assign(target);
	}
</script>

<svelte:head>
	<title>Authorize access — Server Radar</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="flex items-center justify-center px-3 py-10">
	<div class="w-[480px] space-y-6 rounded-lg bg-white p-6 shadow-md dark:bg-gray-800">
		<div class="flex items-center gap-3">
			<FontAwesomeIcon class="h-6 w-6 text-orange-500" icon={faPlug} />
			<h2 class="text-2xl font-semibold text-gray-800 dark:text-white">Authorize access</h2>
		</div>

		<p class="text-gray-600 dark:text-gray-400">
			<strong class="text-gray-900 dark:text-white">{data.clientName}</strong>
			wants to connect to your Server Radar account{#if data.userEmail}
				&nbsp;({data.userEmail}){/if}.
		</p>

		{#if !data.clientKnown}
			<Alert color="red">
				<FontAwesomeIcon class="mr-1 h-4 w-4" icon={faTriangleExclamation} />
				This application is not recognised. Only continue if you started this yourself.
			</Alert>
		{/if}

		<div class="rounded-md border border-gray-200 p-4 dark:border-gray-700">
			<p class="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">It will be able to:</p>
			<ul class="space-y-1 text-sm text-gray-600 dark:text-gray-400">
				{#each data.scopes as scope (scope.id)}
					<li>• {scope.label}</li>
				{/each}
				<li>• View and manage your price alerts</li>
			</ul>
		</div>

		<p class="text-xs text-gray-500 dark:text-gray-400">
			Anyone can register an application, so the name above is not verified. If you did not start
			this from {data.clientName}, deny it.
		</p>

		{#if form?.error}
			<Alert color="red"><span class="font-medium">Error:</span> {form.error}</Alert>
		{/if}

		<div class="flex gap-3">
			<form
				method="POST"
				action="?/deny"
				class="flex-1"
				use:enhance={() => {
					submitting = true;
					return async ({ result }) => handleResult(result);
				}}
			>
				<input type="hidden" name="consent_code" value={data.consentCode} />
				<Button type="submit" color="alternative" class="w-full" disabled={submitting}>Deny</Button>
			</form>

			<form
				method="POST"
				action="?/approve"
				class="flex-1"
				use:enhance={() => {
					submitting = true;
					return async ({ result }) => handleResult(result);
				}}
			>
				<input type="hidden" name="consent_code" value={data.consentCode} />
				<Button type="submit" class="w-full" disabled={submitting}>Allow</Button>
			</form>
		</div>
	</div>
</div>
