<script lang="ts">
	import {
		Modal,
		Label,
		Input,
		MultiSelect,
		Radio,
		Toggle,
		Button,
		Spinner,
		Dropdown,
		Checkbox,
		Search
	} from 'flowbite-svelte';
	import { ChevronDownOutline } from 'flowbite-svelte-icons';

	import { InfoCircleSolid } from 'flowbite-svelte-icons';
	import { addToast } from '$lib/stores/toast';
	import { invalidateAll } from '$app/navigation';
	import { createEventDispatcher } from 'svelte';
	import type { CloudAvailabilityAlert } from '$lib/api/backend/cloud-alerts';

	type Option = { value: number; name: string };

	let {
		open = $bindable(false),
		alert = null,
		serverTypeOptions = [],
		locationOptions = []
	}: {
		open: boolean;
		alert: CloudAvailabilityAlert | null;
		serverTypeOptions: Option[];
		locationOptions: Option[];
	} = $props();

	const dispatch = createEventDispatcher();

	// Form state
	let alertName = $state('');
	let selectedServerTypeIds: number[] = $state([]);
	let selectedLocationIds: number[] = $state([]);
	let alertOn: 'available' | 'unavailable' | 'both' = $state('available');
	let emailNotifications = $state(true);
	let discordNotifications = $state(false);
	let isSubmitting = $state(false);
	let serverTypeSearchTerm = $state('');

	let serverTypeSelections = $derived(
		serverTypeOptions.map((type) => ({
			value: type.value,
			name: type.name,
			checked: selectedServerTypeIds.includes(type.value)
		}))
	);

	let filteredServerTypes = $derived(
		serverTypeSelections.filter((type) =>
			type.name.toLowerCase().includes(serverTypeSearchTerm.toLowerCase())
		)
	);

	function updateSelectedServerTypes(typeValue: number, checked: boolean) {
		if (checked) {
			selectedServerTypeIds = [...selectedServerTypeIds, typeValue];
		} else {
			selectedServerTypeIds = selectedServerTypeIds.filter((id) => id !== typeValue);
		}
	}

	// Validation computed property
	let isFormValid = $derived(
		alertName.trim().length > 0 &&
			selectedServerTypeIds.length > 0 &&
			selectedLocationIds.length > 0 &&
			(emailNotifications || discordNotifications)
	);

	// Update form when alert changes (for editing)
	$effect(() => {
		if (alert) {
			alertName = alert.name;
			selectedServerTypeIds = [...alert.server_type_ids];
			selectedLocationIds = [...alert.location_ids];
			alertOn = alert.alert_on;
			emailNotifications = alert.email_notifications;
			discordNotifications = alert.discord_notifications;
		} else {
			resetForm();
		}
	});

	function resetForm() {
		alertName = '';
		selectedServerTypeIds = [];
		selectedLocationIds = [];
		alertOn = 'available';
		emailNotifications = true;
		discordNotifications = false;
	}

	async function handleSubmit() {
		if (
			!alertName.trim() ||
			selectedServerTypeIds.length === 0 ||
			selectedLocationIds.length === 0
		) {
			addToast({
				message: 'Please fill in all required fields',
				type: 'error',
				dismissible: true,
				timeout: 3000
			});
			return;
		}

		if (!emailNotifications && !discordNotifications) {
			addToast({
				message: 'Please select at least one notification method',
				type: 'error',
				dismissible: true,
				timeout: 3000
			});
			return;
		}

		isSubmitting = true;
		try {
			const existingAlert = alert;
			const url = existingAlert ? `/cloud-alerts/${existingAlert.id}` : '/cloud-alerts';
			const method = existingAlert ? 'PATCH' : 'POST';

			const response = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: alertName,
					serverTypeIds: selectedServerTypeIds,
					locationIds: selectedLocationIds,
					alertOn,
					emailNotifications,
					discordNotifications
				})
			});

			const result = await response.json();

			if (response.ok) {
				addToast({
					message: existingAlert ? 'Cloud alert updated successfully' : 'Cloud alert created successfully',
					type: 'success',
					dismissible: true,
					timeout: 3000
				});
				open = false;
				resetForm();
				await invalidateAll();
				dispatch('success');
			} else {
				throw new Error(result.error || 'Failed to save alert');
			}
		} catch (error) {
			addToast({
				message: error instanceof Error ? error.message : 'Failed to save alert',
				type: 'error',
				dismissible: true,
				timeout: 5000
			});
		} finally {
			isSubmitting = false;
		}
	}

	function handleCancel() {
		open = false;
		resetForm();
	}
</script>

<Modal
	bind:open
	size="md"
	autoclose={false}
	outsideclose={false}
	class="mx-auto w-full max-w-lg"
	style="z-index: 9999;"
>
	<form onsubmit={handleSubmit} class="flex flex-col space-y-3">
		<!-- Header -->
		<h3 class="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
			{alert ? 'Edit Cloud Alert' : 'Create Cloud Alert'}
		</h3>

		<p class="mb-3 text-sm text-gray-600 dark:text-gray-300">
			{alert
				? 'Update your cloud server availability alert settings.'
				: 'Get notified when cloud server availability changes in your selected locations and server types.'}
		</p>

		<Label class="flex flex-col space-y-1">
			<span class="text-sm font-medium text-gray-700 dark:text-gray-300">Alert Name</span>
			<Input
				type="text"
				bind:value={alertName}
				placeholder="e.g., Small instances in EU regions"
				required
				class="text-sm"
			/>
		</Label>

		<Label class="flex flex-col space-y-1">
			<span class="text-sm font-medium text-gray-700 dark:text-gray-300">Server Types</span>
			<div class="relative">
				<Button color="light" class="flex w-full items-center justify-between">
					{selectedServerTypeIds.length} server type{selectedServerTypeIds.length !== 1 ? 's' : ''} selected
					<ChevronDownOutline class="ms-2 h-4 w-4" />
				</Button>
				<Dropdown class="w-full">
					<div class="p-3">
						<Search
							size="sm"
							bind:value={serverTypeSearchTerm}
							placeholder="Search server types..."
						/>
					</div>
					{#each filteredServerTypes as type (type.value)}
						<li class="rounded-sm p-2 hover:bg-gray-100 dark:hover:bg-gray-600">
							<Checkbox
								checked={type.checked}
								on:change={(event) =>
									updateSelectedServerTypes(
										type.value,
										(event.currentTarget as HTMLInputElement).checked
									)
								}
							>
								{type.name}
							</Checkbox>
						</li>
					{/each}
				</Dropdown>
			</div>
		</Label>

		<Label class="flex flex-col space-y-1">
			<span class="text-sm font-medium text-gray-700 dark:text-gray-300">Locations</span>
			<MultiSelect
				items={locationOptions}
				bind:value={selectedLocationIds}
				placeholder="Select locations to monitor"
				required
				class="text-sm"
			/>
		</Label>

		<div class="space-y-2">
			<Label class="text-sm font-medium text-gray-700 dark:text-gray-300">Alert When</Label>
			<div class="space-y-1">
				<Label class="flex items-center space-x-2">
					<Radio
						bind:group={alertOn}
						value="available"
						class="text-orange-500 focus:ring-orange-500"
					/>
					<span class="text-sm text-gray-900 dark:text-white">Server becomes available</span>
				</Label>
				<Label class="flex items-center space-x-2">
					<Radio
						bind:group={alertOn}
						value="unavailable"
						class="text-orange-500 focus:ring-orange-500"
					/>
					<span class="text-sm text-gray-900 dark:text-white">Server becomes unavailable</span>
				</Label>
				<Label class="flex items-center space-x-2">
					<Radio bind:group={alertOn} value="both" class="text-orange-500 focus:ring-orange-500" />
					<span class="text-sm text-gray-900 dark:text-white">Both available and unavailable</span>
				</Label>
			</div>
		</div>

		<!-- Notification Method Selection -->
		<div class="space-y-2">
			<Label class="text-sm font-medium text-gray-700 dark:text-gray-300">
				Notification Methods
			</Label>
			<div class="space-y-2">
				<Label
					class="flex items-center space-x-2 rounded-sm border border-gray-200 p-2 dark:border-gray-600"
				>
					<Toggle bind:checked={emailNotifications} class="text-orange-500 focus:ring-orange-500" />
					<div class="flex flex-1 items-center space-x-2">
						<InfoCircleSolid class="h-4 w-4 text-gray-600 dark:text-gray-300" />
						<div>
							<div class="text-sm font-medium text-gray-900 dark:text-white">Email</div>
							<div class="text-xs text-gray-500 dark:text-gray-400">
								Receive notifications via email
							</div>
						</div>
					</div>
				</Label>
				<Label
					class="flex items-center space-x-2 rounded-sm border border-gray-200 p-2 dark:border-gray-600"
				>
					<Toggle
						bind:checked={discordNotifications}
						class="text-indigo-500 focus:ring-indigo-500"
					/>
					<div class="flex flex-1 items-center space-x-2">
						<InfoCircleSolid class="h-4 w-4 text-indigo-500" />
						<div>
							<div class="text-sm font-medium text-gray-900 dark:text-white">Discord</div>
							<div class="text-xs text-gray-500 dark:text-gray-400">
								Receive rich notifications in Discord
							</div>
						</div>
					</div>
				</Label>
			</div>

			{#if !emailNotifications && !discordNotifications}
				<div
					class="rounded-sm border border-red-200 bg-red-50 p-2 dark:border-red-700 dark:bg-red-900/20"
				>
					<p class="text-xs text-red-900 dark:text-red-100">
						Please select at least one notification method.
					</p>
				</div>
			{/if}
		</div>

		<!-- Action Buttons -->
		<div class="flex justify-end space-x-2 pt-2">
			<Button type="button" color="alternative" size="sm" on:click={handleCancel}>Cancel</Button>
			<Button type="submit" color="primary" size="sm" disabled={isSubmitting || !isFormValid}>
				{#if isSubmitting}
					<Spinner size="4" class="ms-0 me-1" /> Saving
				{:else}
					{alert ? 'Update' : 'Create'} Alert
				{/if}
			</Button>
		</div>
	</form>
</Modal>
