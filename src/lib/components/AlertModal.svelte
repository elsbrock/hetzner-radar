<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidate } from '$app/navigation';
	import { MAX_ALERTS, MAX_NAME_LENGTH, type PriceAlert } from '$lib/api/backend/alerts';
	import { createDefaultFilter } from '$lib/filter';
	import { filter } from '$lib/stores/filter';
	import { session } from '$lib/stores/session';
	import { addToast } from '$lib/stores/toast';
	import { settingsStore } from '$lib/stores/settings';
	import { A, Alert, Button, Input, Label, Modal, Spinner, Checkbox } from 'flowbite-svelte';
	import { faEnvelope } from '@fortawesome/free-solid-svg-icons';
	import { faDiscord } from '@fortawesome/free-brands-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { createEventDispatcher } from 'svelte';

	let {
		alert = $bindable(null),
		open = $bindable(false),
		user = { notification_preferences: { email: true, discord: false } }
	}: {
		alert: PriceAlert | null;
		open: boolean;
		user?: {
			discord_webhook_url?: string | null;
			notification_preferences: {
				email: boolean;
				discord: boolean;
			};
		};
	} = $props();

	interface AlertFormErrors {
		name?: string;
		price?: string;
		vatRate?: string;
	}

	let loading = $state(false);
	let error: string = $state('');
	const dispatch = createEventDispatcher();

	// Notification method selection for this specific alert
	let emailSelected = $state(true);
	let discordSelected = $state(false);

	// Update notification selections when alert changes
	$effect(() => {
		if (alert) {
			// Editing existing alert - use its notification settings, with fallbacks for migration case
			emailSelected = alert.email_notifications ?? true; // Default to true if null/undefined
			discordSelected =
				alert.discord_notifications ??
				(user.notification_preferences.discord && !!user.discord_webhook_url);
		} else {
			// Creating new alert - use defaults based on user config
			emailSelected = true; // Email always defaults to true
			discordSelected = user.notification_preferences.discord && !!user.discord_webhook_url;
		}
	});

	// Available notification methods based on user configuration
	const availableNotificationMethods = $derived(
		[
			{
				key: 'email',
				label: 'Email',
				icon: faEnvelope,
				enabled: true, // Email is always available
				description: 'Receive notifications via email',
				checked: emailSelected
			},
			{
				key: 'discord',
				label: 'Discord',
				icon: faDiscord,
				enabled: user.notification_preferences.discord && !!user.discord_webhook_url,
				description: 'Receive rich notifications in Discord',
				checked: discordSelected
			}
		].filter((method) => method.enabled)
	);

	// Validation: at least one method must be selected
	const hasValidNotificationSelection = $derived(emailSelected || discordSelected);

	const action = $derived(alert ? '/alerts?/edit' : '/alerts?/add');
	const serializedFilter = $derived(() => {
		if (alert && typeof alert.filter === 'string') {
			return alert.filter;
		}

		const activeFilter = $filter ?? createDefaultFilter();
		return JSON.stringify(activeFilter);
	});
</script>

<Modal bind:open size="md" autoclose={false} outsideclose class="mx-auto w-full max-w-md">
	{#if $session}
		<form
			class="flex flex-col space-y-4"
			method="POST"
			{action}
			use:enhance={() => {
				loading = true;
				error = ''; // Clear any previous errors
				return async ({ result, update }) => {
					loading = false;
					// Check result type for success or failure before accessing data
					if (result.type === 'success' || result.type === 'failure') {
						if (result.data?.success) {
							open = false;
							if (alert) {
								addToast({
									color: 'green',
									message: 'Alert updated successfully.',
									icon: 'success'
								});
							} else {
								addToast({
									color: 'green',
									message: 'Alert set up successfully.',
									icon: 'success'
								});
							}
							invalidate('/alerts'); // Invalidate data to refresh lists/views
							dispatch('success'); // Dispatch success event if needed
						} else if (result.data?.errors) {
							const errors = result.data.errors as AlertFormErrors;
							error = errors.name || errors.price || errors.vatRate || 'Validation error occurred.';
						} else if (result.data?.error) {
							error =
								typeof result.data.error === 'string'
									? result.data.error
									: 'An unknown error occurred.';
						} else {
							// Handle unexpected result structure or generic failure
							error = 'An unexpected error occurred.';
						}
					} else if (result.type === 'error') {
						// Handle client-side errors or network issues if necessary
						error = result.error?.message || 'An error occurred during submission.';
					}
					// Ensure the form state is updated if necessary, e.g., after validation errors
					update({ reset: false });
				};
			}}
		>
			<!-- Header -->
			<h3 class="text-2xl font-semibold text-gray-900 dark:text-white">
				{#if alert}Edit Price Alert{:else}Set Up a Price Alert{/if}
			</h3>

			{#if !alert}
				<p class="text-sm text-gray-600 dark:text-gray-300">
					Get notified when the price of this configuration (including the standard €1.70 net IPv4
					cost) drops below your desired monthly price.
				</p>
				<p class="text-sm text-gray-600 dark:text-gray-300">
					Please enter the desired price <em>including</em> VAT according to your current selection;
					the alert will trigger based on this VAT-inclusive comparison, which incorporates the standard
					IPv4 cost. You will receive a single notification, and the alert will automatically disable
					itself afterwards.
				</p>
				<p class="text-sm text-gray-600 dark:text-gray-300">
					Manage all your alerts anytime in the <A href="/alerts">Alerts</A> section.
					<span class="font-semibold"
						>Note that you can store a maximum of {MAX_ALERTS} active alerts.</span
					>
				</p>
			{/if}

			<input type="hidden" name="alertId" value={alert?.id} />
			<input type="hidden" name="filter" value={serializedFilter} />
			{#if !alert}
				<input type="hidden" name="vatRate" value={$settingsStore.currentVatRate ?? 0} />
			{/if}
			<input type="hidden" name="emailNotifications" value={emailSelected ? 'true' : 'false'} />
			<input type="hidden" name="discordNotifications" value={discordSelected ? 'true' : 'false'} />

			<Label class="flex flex-col space-y-1">
				<span class="text-sm font-medium text-gray-700 dark:text-gray-300">Name</span>
				<Input
					type="text"
					name="name"
					placeholder="Backup Server"
					maxlength={MAX_NAME_LENGTH}
					required
					value={alert?.name}
					class="rounded-md border px-3 py-2 focus:ring-1 focus:ring-orange-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
				/>
			</Label>

			<!-- Price Input -->
			<Label class="flex flex-col space-y-1">
				<span class="text-sm font-medium text-gray-700 dark:text-gray-300"
					>Desired Monthly Price (EUR)</span
				>
				<Input
					type="tel"
					name="price"
					placeholder="e.g., 50"
					required
					min="20"
					max="1000"
					value={alert?.price}
					class="rounded-md border px-3 py-2 focus:ring-1 focus:ring-orange-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
				/>
			</Label>

			<!-- Notification Method Selection -->
			{#if availableNotificationMethods.length > 0}
				<div class="space-y-3">
					<Label class="text-sm font-medium text-gray-700 dark:text-gray-300">
						Notification Methods
					</Label>
					<p class="text-xs text-gray-500 dark:text-gray-400">
						Your active notification methods (configured in <A href="/settings" class="underline"
							>Settings</A
						>)
					</p>
					<div class="space-y-2">
						{#each availableNotificationMethods as method (method.key)}
							<Label
								class="flex items-center space-x-3 rounded-lg border border-gray-200 p-3 dark:border-gray-600"
							>
								{#if method.key === 'email'}
									<Checkbox
										bind:checked={emailSelected}
										class="text-orange-500 focus:ring-orange-500"
									/>
								{:else}
									<Checkbox
										bind:checked={discordSelected}
										class="text-indigo-500 focus:ring-indigo-500"
									/>
								{/if}
								<div class="flex flex-1 items-center space-x-2">
									<FontAwesomeIcon
										icon={method.icon}
										class="h-4 w-4 {method.key === 'discord'
											? 'text-indigo-500'
											: 'text-gray-600 dark:text-gray-300'}"
									/>
									<div>
										<div class="text-sm font-medium text-gray-900 dark:text-white">
											{method.label}
										</div>
										<div class="text-xs text-gray-500 dark:text-gray-400">
											{method.description}
										</div>
									</div>
								</div>
							</Label>
						{/each}
					</div>

					{#if !hasValidNotificationSelection}
						<div
							class="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-700 dark:bg-red-900/20"
						>
							<p class="text-sm text-red-900 dark:text-red-100">
								Please select at least one notification method.
							</p>
						</div>
					{/if}
				</div>
			{:else}
				<div
					class="rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-700 dark:bg-yellow-900/20"
				>
					<p class="text-sm text-yellow-900 dark:text-yellow-100">
						No notification methods are configured. Please configure at least one notification
						method in <A href="/settings" class="underline">Settings</A>.
					</p>
				</div>
			{/if}

			<!-- Error -->
			{#if error}
				<Alert color="red"><strong>Error:</strong> {error}</Alert>
			{/if}

			<!-- Action Buttons -->
			<div class="flex justify-end space-x-2">
				<Button type="button" color="alternative" onclick={() => (open = false)}>Cancel</Button>
				<Button type="submit" color="primary" disabled={loading || !hasValidNotificationSelection}>
					{#if loading}
						<Spinner size="4" class="ms-0 me-2" /> Saving
					{:else}
						Save Alert
					{/if}
				</Button>
			</div>
		</form>
	{:else}
		<h3 class="text-2xl font-semibold text-gray-900 dark:text-white">Sign In to Set Up Alerts</h3>

		<!-- Description -->
		<p class="text-sm text-gray-600 dark:text-gray-300">
			We can notify you about your target price.
		</p>
		<p class="text-sm text-gray-600 dark:text-gray-300">
			You need to be signed in to set up price alerts. No sign-up required, just enter your email
			address, and we will send you a magic code to sign in.
		</p>
		<Button href="/auth/login" color="primary" class="w-full">Sign In</Button>
	{/if}
</Modal>
