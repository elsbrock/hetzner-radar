<script lang="ts">
	import { enhance as _enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import AlertModal from '$lib/components/AlertModal.svelte';
	import AlertAuctionsDrawer from '$lib/components/AlertAuctionsDrawer.svelte';
	import CloudAlertModal from '$lib/components/CloudAlertModal.svelte';
	import { encodeFilter, parseStoredFilter } from '$lib/filter';
	import { addToast } from '$lib/stores/toast';
	import { invalidateAll } from '$app/navigation';
	import { MAX_ALERTS } from '$lib/api/backend/alerts.js';
	import { MAX_CLOUD_ALERTS } from '$lib/api/backend/cloud-alerts.js';
	import type { CloudAvailabilityAlert } from '$lib/api/backend/cloud-alerts';
	import { page } from '$app/stores';
	import type { PriceAlert, PriceAlertHistory } from '$lib/api/backend/alerts';
	import { currencySymbol, currentCurrency } from '$lib/stores/settings';
	import { convertPrice } from '$lib/currency';

	type CloudStatusSummary = {
		serverTypes?: Array<{
			id: number;
			name: string;
			description?: string;
			cores: number;
			memory: number;
		}>;
		locations?: Array<{
			id: number;
			name: string;
			city: string;
			country: string;
		}>;
	};
	type AlertsPageData = import('./$types').PageData;

	import dayjs from 'dayjs';
	import localizedFormat from 'dayjs/plugin/localizedFormat';
	import timezone from 'dayjs/plugin/timezone';
	import utc from 'dayjs/plugin/utc';
	dayjs.extend(localizedFormat);
	dayjs.extend(utc);
	dayjs.extend(timezone);

	function resolveAnalyzeTarget(rawFilter: string | null | undefined) {
		const parsed = parseStoredFilter(rawFilter);
		return {
			href: parsed ? `/analyze?filter=${encodeFilter(parsed)}` : '/analyze',
			missing: !parsed
		};
	}

	import {
		Tabs,
		TabItem,
		Badge,
		Button,
		Spinner,
		Alert,
		Modal,
		ButtonGroup
	} from 'flowbite-svelte';
	import {
		BellRingSolid,
		BullhornSolid,
		PenSolid,
		TrashBinSolid,
		CheckCircleSolid,
		CloseCircleSolid,
		ExclamationCircleSolid,
		InfoCircleSolid
	} from 'flowbite-svelte-icons';
	import {
		faFire,
		faFlagCheckered,
		faMagnifyingGlass,
		faPenToSquare,
		faTrash,
		faBoxOpen,
		faRotateRight
	} from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';

	let { data }: { data: AlertsPageData } = $props();
	const cloudStatusData = $derived((data.cloudStatusData ?? null) as CloudStatusSummary | null);

	// Tabs state
	let activeTab = $state('price-alerts');
	let priceAlertsTabOpen = $state(false);
	let cloudAlertsTabOpen = $state(false);

	// Initialize and sync with URL
	$effect(() => {
		const tabParam = $page.url.searchParams.get('tab');
		activeTab = tabParam === 'cloud-alerts' ? 'cloud-alerts' : 'price-alerts';
	});

	$effect(() => {
		priceAlertsTabOpen = activeTab === 'price-alerts';
		cloudAlertsTabOpen = activeTab === 'cloud-alerts';
	});

	$effect(() => {
		if (priceAlertsTabOpen) {
			activeTab = 'price-alerts';
		} else if (cloudAlertsTabOpen) {
			activeTab = 'cloud-alerts';
		}
	});

	// Keep the selected tab in the URL so it survives reloads and can be shared
	$effect(() => {
		if (!browser) return;
		const urlTab =
			$page.url.searchParams.get('tab') === 'cloud-alerts' ? 'cloud-alerts' : 'price-alerts';
		if (activeTab === urlTab) return;
		const url = new URL($page.url);
		if (activeTab === 'cloud-alerts') {
			url.searchParams.set('tab', 'cloud-alerts');
		} else {
			url.searchParams.delete('tab');
		}
		goto(url.pathname + url.search, { replaceState: true, keepFocus: true, noScroll: true });
	});

	// Price alerts state
	let showEdit = $state(false);
	let selectedAlert = $state<PriceAlert | null>(null);
	let drawerOpen = $state(false);
	let selectedAlertId = $state<string | null>(null);
	let selectedVatRate = $state(0);

	// Cloud alerts state
	let showCloudAlertModal = $state(false);
	let editingCloudAlert = $state<CloudAvailabilityAlert | null>(null);

	// Delete confirmation modal state
	let showDeleteModal = $state(false);
	let deleteConfirmation = $state({
		type: 'price' as 'price' | 'cloud',
		alertId: '',
		alertName: '',
		isDeleting: false
	});

	// Check URL parameters and hash on mount
	onMount(async () => {
		// Tab is now automatically handled by derived value

		const viewParam = $page.url.searchParams.get('view');
		if (viewParam && !drawerOpen) {
			try {
				const response = await fetch(`/alerts/${viewParam}/auctions`);

				if (!response.ok) {
					addToast({
						message: 'Alert not found or auctions unavailable.',
						type: 'error',
						dismissible: true,
						timeout: 3000
					});

					const url = new URL(window.location.href);
					url.searchParams.delete('view');
					 
					goto(url.pathname + url.search, { replaceState: true, keepFocus: true });
					return;
				}

				selectedAlertId = viewParam;
				selectedVatRate = 0;
				drawerOpen = true;
			} catch (err) {
				console.error('Error checking alert:', err);
				addToast({
					message: 'Failed to check alert. Please try again later.',
					type: 'error',
					dismissible: true,
					timeout: 3000
				});

				const url = new URL(window.location.href);
				url.searchParams.delete('view');
				 
				goto(url.pathname + url.search, { replaceState: true, keepFocus: true });
			}
		}
	});

	// Reset selectedAlertId when drawer is closed
	$effect(() => {
		if (!drawerOpen) {
			selectedAlertId = null;
		}
	});

	// Tab switching is now handled automatically by the derived activeTab value

	// Delete confirmation functions
	function openDeleteConfirmation(type: 'price' | 'cloud', alertId: string, alertName: string) {
		deleteConfirmation = {
			type,
			alertId,
			alertName,
			isDeleting: false
		};
		showDeleteModal = true;
	}

	async function confirmDelete() {
		if (!deleteConfirmation.alertId) return;

		deleteConfirmation.isDeleting = true;

		try {
			if (deleteConfirmation.type === 'cloud') {
				// Cloud alert deletion
				const response = await fetch(`/cloud-alerts/${deleteConfirmation.alertId}`, {
					method: 'DELETE'
				});

				if (response.ok) {
					addToast({
						message: 'Cloud alert deleted successfully',
						type: 'success',
						dismissible: true,
						timeout: 3000
					});
					await invalidateAll();
				} else {
					const result = await response.json();
					throw new Error(result.error || 'Failed to delete alert');
				}
			} else {
				// Price alert deletion - use form submission
				const form = document.createElement('form');
				form.method = 'POST';
				form.action = '?/delete';

				const alertIdInput = document.createElement('input');
				alertIdInput.type = 'hidden';
				alertIdInput.name = 'alertId';
				alertIdInput.value = deleteConfirmation.alertId;
				form.appendChild(alertIdInput);

				document.body.appendChild(form);
				form.submit();

				addToast({
					type: 'success',
					message: 'Alert deleted successfully.',
					dismissible: true,
					timeout: 3000
				});
				return; // Don't set showDeleteModal = false for price alerts since page will reload
			}
		} catch (error) {
			addToast({
				message: error instanceof Error ? error.message : 'Failed to delete alert',
				type: 'error',
				dismissible: true,
				timeout: 5000
			});
		}

		showDeleteModal = false;
		deleteConfirmation.isDeleting = false;
	}

	async function rearmCloudAlert(alertId: string) {
		try {
			const response = await fetch(`/cloud-alerts/${alertId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ isArmed: true })
			});

			if (response.ok) {
				addToast({
					message: 'Alert re-armed successfully',
					type: 'success',
					dismissible: true,
					timeout: 3000
				});
				await invalidateAll();
			} else {
				const result = await response.json();
				throw new Error(result.error || 'Failed to re-arm alert');
			}
		} catch (error) {
			addToast({
				message: error instanceof Error ? error.message : 'Failed to re-arm alert',
				type: 'error',
				dismissible: true,
				timeout: 5000
			});
		}
	}

	async function openTriggeredAuctions(alert: PriceAlertHistory) {
		try {
			const response = await fetch(`/alerts/${alert.id}/auctions`);
			if (!response.ok) {
				addToast({
					message: 'Alert not found or auctions unavailable.',
					type: 'error',
					dismissible: true,
					timeout: 3000
				});
				return;
			}
			selectedAlertId = alert.id;
			selectedVatRate = alert.vat_rate;
			drawerOpen = true;
		} catch (err) {
			console.error('Error checking alert:', err);
			addToast({
				message: 'Failed to check alert. Please try again later.',
				type: 'error',
				dismissible: true,
				timeout: 3000
			});
		}
	}

	function openCreateCloudAlertModal() {
		editingCloudAlert = null;
		showCloudAlertModal = true;
	}

	function openEditCloudAlertModal(alert: CloudAvailabilityAlert) {
		editingCloudAlert = alert;
		showCloudAlertModal = true;
	}

	// Generate server type and location options from cloud status data
	const serverTypeOptions = $derived(
		(cloudStatusData?.serverTypes ?? []).map((st) => ({
			value: st.id,
			name: `${st.name.toUpperCase()} - ${st.cores} Core${st.cores > 1 ? 's' : ''} / ${st.memory} GB RAM`
		}))
	);

	const locationOptions = $derived(
		(cloudStatusData?.locations ?? []).map((loc) => ({
			value: loc.id,
			name: `${loc.city}, ${loc.country} (${loc.name})`
		}))
	);
</script>

<AlertModal
	bind:alert={selectedAlert}
	bind:open={showEdit}
	user={data.user}
	on:success={() => invalidateAll()}
/>

{#if drawerOpen && selectedAlertId}
	<AlertAuctionsDrawer
		alertId={selectedAlertId}
		bind:open={drawerOpen}
		vatRate={selectedVatRate}
	/>
{/if}

<div class="p-6">
	<div class="mx-auto max-w-5xl">
		<!-- Header -->
		<div class="mb-8">
			<h1 class="mb-2 text-4xl font-bold text-gray-900 dark:text-white">Alert Management</h1>
			<p class="text-base text-gray-600 dark:text-gray-400">
				Monitor server prices and cloud availability with smart notifications
			</p>
		</div>

		<!-- Tabs -->
		<Tabs contentClass="mt-6">
			<TabItem bind:open={priceAlertsTabOpen}>
				{#snippet titleSlot()}
					<div class="flex items-center gap-2">
						<BellRingSolid class="h-4 w-4" />
						Price Alerts
					</div>
				{/snippet}

				<div class="space-y-6">
					<!-- Price Alerts Header -->
					<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<p class="text-gray-600 dark:text-gray-400">
							Get notified when server prices drop below your target.
						</p>
						<Button href="/analyze">
							<BellRingSolid class="mr-2 h-4 w-4" />
							Create Price Alert
						</Button>
					</div>

					<!-- Active Price Alerts -->
					{#await data.alerts.active}
						<div class="flex justify-center py-12">
							<Spinner size="8" />
						</div>
					{:then active}
						<div class="grid gap-4">
							<div>
								<h3 class="mb-2 text-lg font-medium text-gray-900 dark:text-white">
									<FontAwesomeIcon icon={faFire} class="mr-2 inline h-5 w-5 text-orange-500" />
									Active Alerts ({active.length}/{MAX_ALERTS})
								</h3>
								<p class="mb-4 text-base text-gray-600 dark:text-gray-400">
									Prices are monitored continuously; you are notified once your target is reached.
									Create alerts from your search results on <a
										href={resolve('/analyze')}
										class="text-orange-500 underline hover:text-orange-600">analyze</a
									>.
								</p>
							</div>

							{#if active.length === 0}
								<div class="rounded-lg bg-white p-4 text-center shadow-xs dark:bg-gray-800">
									<p class="text-lg text-gray-700 dark:text-gray-300">
										There are no active alerts.
									</p>
								</div>
							{:else}
								<div class="space-y-3">
									{#each active as alert (alert.id)}
										<div
											class="flex flex-col rounded-lg border-l-4 border-l-gray-300 bg-white p-3 shadow-xs md:flex-row md:items-start dark:border-l-gray-700 dark:bg-gray-800"
										>
											<div class="mb-3 w-full md:mb-0 md:w-1/3">
												<span class="block text-sm font-medium text-gray-600 dark:text-gray-400"
													>Name</span
												>
												<span
													class="text-lg font-semibold text-ellipsis whitespace-nowrap text-gray-900 dark:text-white"
												>
													{alert.name}
												</span>
											</div>
											<div class="mb-3 w-full md:mb-0 md:w-1/3">
												<span class="block text-sm font-medium text-gray-600 dark:text-gray-400"
													>Target Price</span
												>
												<div>
													<span class="text-lg font-semibold text-gray-900 dark:text-white">
														{$currencySymbol}{convertPrice(alert.price, 'EUR', $currentCurrency).toFixed(2)}
													</span>
													<span class="block text-xs text-gray-500 dark:text-gray-400">
														(incl. {alert.vat_rate}% VAT)
													</span>
												</div>
											</div>
											<div class="mb-3 w-full md:mb-0 md:w-1/3">
												<span class="block text-sm font-medium text-gray-600 dark:text-gray-400"
													>Notifications</span
												>
												<div class="mt-1 flex items-center gap-2 text-sm">
													{#if alert.email_notifications}
														<div class="flex items-center gap-1">
															<CheckCircleSolid class="h-3 w-3 text-green-500" />
															<span class="text-gray-900 dark:text-white">Email</span>
														</div>
													{/if}
													{#if alert.discord_notifications}
														<div class="flex items-center gap-1">
															<CheckCircleSolid class="h-3 w-3 text-blue-500" />
															<span class="text-gray-900 dark:text-white">Discord</span>
														</div>
													{/if}
													{#if alert.webhook_notifications}
														<div class="flex items-center gap-1">
															<CheckCircleSolid class="h-3 w-3 text-teal-500" />
															<span class="text-gray-900 dark:text-white">Webhook</span>
														</div>
													{/if}
												</div>
											</div>
											<div class="mt-3 self-center md:mt-0">
												<ButtonGroup>
													{@const analyzeTarget = resolveAnalyzeTarget(alert.filter)}
													<Button
														size="xs"
														href={analyzeTarget.href}
														title={analyzeTarget.missing
															? 'Saved filter was unavailable; opening Analyze with defaults.'
															: 'Open Analyze with this saved search'}
													>
														<FontAwesomeIcon icon={faMagnifyingGlass} />
													</Button>
													<Button
														size="xs"
														title="Edit alert"
														onclick={() => {
															selectedAlert = alert;
															showEdit = true;
														}}
													>
														<FontAwesomeIcon icon={faPenToSquare} />
													</Button>
													<Button
														size="xs"
														color="red"
														title="Delete alert"
														onclick={() => openDeleteConfirmation('price', alert.id, alert.name)}
													>
														<FontAwesomeIcon icon={faTrash} />
													</Button>
												</ButtonGroup>
											</div>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{:catch error}
						<Alert color="red" class="rounded-2xl">
							{#snippet icon()}
								<ExclamationCircleSolid class="h-4 w-4" />
							{/snippet}
							<strong>Error:</strong> Could not load price alerts.
						</Alert>
					{/await}

					<!-- Triggered Price Alerts -->
					{#await data.alerts.triggered}
						<div class="flex justify-center py-8">
							<Spinner size="6" />
						</div>
					{:then triggered}
						<div class="grid gap-4">
							<div>
								<h3 class="mb-2 text-lg font-medium text-gray-900 dark:text-white">
									<FontAwesomeIcon
										icon={faFlagCheckered}
										class="mr-2 inline h-5 w-5 text-green-500"
									/>
									Recently Triggered ({triggered.length})
								</h3>
								<p class="mb-4 text-base text-gray-600 dark:text-gray-400">
									A triggered alert notifies you once, then disables itself. You can recreate it any
									time; the last 10 are shown here.
								</p>
							</div>

							{#if triggered.length === 0}
								<div class="rounded-lg bg-white p-4 text-center shadow-xs dark:bg-gray-800">
									<p class="text-lg text-gray-700 dark:text-gray-300">
										No alerts have triggered yet.
									</p>
								</div>
							{:else}
								<div class="space-y-3">
									{#each triggered as alert (alert.id)}
										<div
											class="flex flex-col rounded-lg border-l-4 border-l-green-500 bg-white p-3 shadow-xs md:flex-row md:items-start dark:bg-gray-800"
										>
											<div class="mb-3 w-full md:mb-0 md:w-1/5">
												<span class="block text-sm font-medium text-gray-600 dark:text-gray-400"
													>Name</span
												>
												<span
													class="text-lg font-semibold text-ellipsis whitespace-nowrap text-gray-900 dark:text-white"
												>
													{alert.name}
												</span>
											</div>
											<div class="mb-3 w-full md:mb-0 md:w-1/5">
												<span class="block text-sm font-medium text-gray-600 dark:text-gray-400"
													>Target</span
												>
												<span class="text-lg font-semibold text-gray-900 dark:text-white">
													{$currencySymbol}{convertPrice(alert.price, 'EUR', $currentCurrency).toFixed(2)}
												</span>
											</div>
											<div class="mb-3 w-full md:mb-0 md:w-1/5">
												<span class="block text-sm font-medium text-gray-600 dark:text-gray-400"
													>Trigger Price</span
												>
												<span class="text-lg font-semibold text-green-600 dark:text-green-400">
													{$currencySymbol}{convertPrice(alert.trigger_price, 'EUR', $currentCurrency).toFixed(2)}
												</span>
											</div>
											<div class="mb-3 w-full md:mb-0 md:w-1/5">
												<span class="block text-sm font-medium text-gray-600 dark:text-gray-400"
													>Triggered</span
												>
												<span class="text-lg font-semibold text-gray-900 dark:text-white">
													{dayjs.utc(alert.triggered_at).local().format('MMM D, HH:mm')}
												</span>
											</div>
											<div class="mt-3 w-full self-center md:mt-0 md:w-1/5">
												<ButtonGroup>
													{@const analyzeTarget = resolveAnalyzeTarget(alert.filter)}
													<Button
														size="xs"
														href={analyzeTarget.href}
														title={analyzeTarget.missing
															? 'Saved filter was unavailable; opening Analyze with defaults.'
															: 'Open Analyze with this saved search'}
													>
														<FontAwesomeIcon icon={faMagnifyingGlass} />
													</Button>
													<Button
														size="xs"
														title="View matched auctions"
														onclick={() => openTriggeredAuctions(alert)}
													>
														<FontAwesomeIcon icon={faBoxOpen} />
													</Button>
												</ButtonGroup>
											</div>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{:catch error}
						<Alert color="red" class="rounded-2xl">
							{#snippet icon()}
								<ExclamationCircleSolid class="h-4 w-4" />
							{/snippet}
							<strong>Error:</strong> Could not load triggered alerts.
						</Alert>
					{/await}
				</div>
			</TabItem>

			<TabItem bind:open={cloudAlertsTabOpen}>
				{#snippet titleSlot()}
					<div class="flex items-center gap-2">
						<BullhornSolid class="h-4 w-4" />
						Cloud Alerts
					</div>
				{/snippet}

				<div class="space-y-6">
					<!-- Cloud Alerts Header -->
					<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<p class="text-gray-600 dark:text-gray-400">
							Get notified when cloud server availability changes.
						</p>
						<Button onclick={openCreateCloudAlertModal}>
							<BellRingSolid class="mr-2 h-4 w-4" />
							Create Cloud Alert
						</Button>
					</div>

					<!-- Active Cloud Alerts -->
					{#if data.cloudAlerts}
						<div class="grid gap-4">
							<div>
								<h3 class="mb-2 text-lg font-medium text-gray-900 dark:text-white">
									<BullhornSolid class="mr-2 inline h-5 w-5 text-blue-500" />
									Active Alerts ({data.cloudAlerts.activeAlerts.length}/{MAX_CLOUD_ALERTS})
								</h3>
								<p class="mb-4 text-base text-gray-600 dark:text-gray-400">
									Notifies you when your selected server types become available or unavailable in
									the chosen locations. Alerts disarm after firing; re-arm them any time.
								</p>
							</div>

							{#if data.cloudAlerts.activeAlerts.length === 0}
								<div class="rounded-lg bg-white p-4 text-center shadow-xs dark:bg-gray-800">
									<p class="text-lg text-gray-700 dark:text-gray-300">
										There are no active cloud alerts.
									</p>
								</div>
							{:else}
								<div class="space-y-3">
									{#each data.cloudAlerts.activeAlerts as alert (alert.id)}
										<div
											class="flex flex-col rounded-lg border-l-4 bg-white p-3 shadow-xs md:flex-row md:items-start dark:bg-gray-800 {alert.is_armed ? 'border-l-blue-500' : 'border-l-gray-300 dark:border-l-gray-600'}"
										>
											<div class="mb-3 w-full md:mb-0 md:w-1/5">
												<span class="block text-sm font-medium text-gray-600 dark:text-gray-400"
													>Name</span
												>
												<span
													class="text-lg font-semibold text-ellipsis whitespace-nowrap text-gray-900 dark:text-white"
												>
													{alert.name}
												</span>
												{#if !alert.is_armed}
													<Badge color="gray" class="mt-1 text-xs">Disarmed</Badge>
												{/if}
											</div>
											<div class="mb-3 w-full md:mb-0 md:w-1/5">
												<span class="block text-sm font-medium text-gray-600 dark:text-gray-400"
													>Alert Type</span
												>
												<Badge
													color={alert.alert_on === 'available'
														? 'green'
														: alert.alert_on === 'unavailable'
															? 'red'
															: 'yellow'}
													class="text-xs"
												>
													{alert.alert_on}
												</Badge>
											</div>
											<div class="mb-3 w-full md:mb-0 md:w-1/5">
												<span class="block text-sm font-medium text-gray-600 dark:text-gray-400"
													>Server Types</span
												>
												<div class="flex flex-wrap gap-1">
													{#each alert.server_type_ids.slice(0, 2) as typeId (typeId)}
														{@const serverType = serverTypeOptions.find(
															(st) => st.value === typeId
														)}
														{#if serverType}
															<Badge color="blue" class="text-xs">
																{serverType.name.split(' - ')[0]}
															</Badge>
														{/if}
													{/each}
													{#if alert.server_type_ids.length > 2}
														<Badge color="primary" class="text-xs"
															>+{alert.server_type_ids.length - 2}</Badge
														>
													{/if}
												</div>
											</div>
											<div class="mb-3 w-full md:mb-0 md:w-1/5">
												<span class="block text-sm font-medium text-gray-600 dark:text-gray-400"
													>Locations</span
												>
												<div class="flex flex-wrap gap-1">
													{#each alert.location_ids.slice(0, 2) as locId (locId)}
														{@const location = locationOptions.find((loc) => loc.value === locId)}
														{#if location}
															<Badge color="purple" class="text-xs">
																{(
																	location.name.split(' (')[1]?.replace(')', '') || location.name
																).toUpperCase()}
															</Badge>
														{/if}
													{/each}
													{#if alert.location_ids.length > 2}
														<Badge color="primary" class="text-xs"
															>+{alert.location_ids.length - 2}</Badge
														>
													{/if}
												</div>
											</div>
											<div class="mb-3 w-full md:mb-0 md:w-1/5">
												<span class="block text-sm font-medium text-gray-600 dark:text-gray-400"
													>Notifications</span
												>
												<div class="flex items-center gap-2 text-sm">
													{#if alert.email_notifications}
														<div class="flex items-center gap-1">
															<CheckCircleSolid class="h-3 w-3 text-green-500" />
															<span class="text-gray-900 dark:text-white">Email</span>
														</div>
													{/if}
													{#if alert.discord_notifications}
														<div class="flex items-center gap-1">
															<CheckCircleSolid class="h-3 w-3 text-blue-500" />
															<span class="text-gray-900 dark:text-white">Discord</span>
														</div>
													{/if}
												</div>
											</div>
											<div class="mt-3 self-center md:mt-0">
												<ButtonGroup>
													{#if !alert.is_armed}
														<Button
															size="xs"
															color="green"
															onclick={() => rearmCloudAlert(alert.id)}
															title="Re-arm alert"
														>
															<FontAwesomeIcon icon={faRotateRight} class="h-4 w-4" />
														</Button>
													{/if}
													<Button
														size="xs"
														title="Edit alert"
														onclick={() => openEditCloudAlertModal(alert)}
													>
														<PenSolid class="h-4 w-4" />
													</Button>
													<Button
														size="xs"
														color="red"
														title="Delete alert"
														onclick={() => openDeleteConfirmation('cloud', alert.id, alert.name)}
													>
														<TrashBinSolid class="h-4 w-4" />
													</Button>
												</ButtonGroup>
											</div>
										</div>
									{/each}
								</div>
							{/if}
						</div>

						<!-- Cloud Alert History -->
						{#if data.cloudAlerts.triggeredAlerts.length > 0}
							<div class="grid gap-4">
								<div>
									<h3 class="mb-2 text-lg font-medium text-gray-900 dark:text-white">
										<CheckCircleSolid class="mr-2 inline h-5 w-5 text-green-500" />
										Recent Triggers ({data.cloudAlerts.triggeredAlerts.length})
									</h3>
									<p class="mb-4 text-base text-gray-600 dark:text-gray-400">
										Cloud availability changes that have triggered your alerts are shown here.
										Alerts are automatically disarmed after firing. You can re-arm them from the
										active alerts list above. We show the most recent triggers.
									</p>
								</div>

								<div class="space-y-3">
									{#each data.cloudAlerts.triggeredAlerts.slice(0, 10) as trigger (trigger.id || `${trigger.server_type_name}-${trigger.location_name}-${trigger.triggered_at}`)}
										<div
											class="flex flex-col rounded-lg border-l-4 bg-white p-3 shadow-xs md:flex-row md:items-start dark:bg-gray-800 {trigger.event_type ===
											'available'
												? 'border-l-green-500'
												: 'border-l-red-500'}"
										>
											<div class="mb-3 w-full md:mb-0 md:w-1/4">
												<span class="block text-sm font-medium text-gray-600 dark:text-gray-400"
													>Server Type</span
												>
												<span class="text-lg font-semibold text-gray-900 dark:text-white">
													{trigger.server_type_name.toUpperCase()}
												</span>
											</div>
											<div class="mb-3 w-full md:mb-0 md:w-1/4">
												<span class="block text-sm font-medium text-gray-600 dark:text-gray-400"
													>Location</span
												>
												<span class="text-lg font-semibold text-gray-900 dark:text-white">
													{trigger.location_name.toUpperCase()}
												</span>
											</div>
											<div class="mb-3 w-full md:mb-0 md:w-1/4">
												<span class="block text-sm font-medium text-gray-600 dark:text-gray-400"
													>Status</span
												>
												<div class="flex items-center gap-2">
													{#if trigger.event_type === 'available'}
														<CheckCircleSolid class="h-4 w-4 text-green-500" />
														<span class="text-lg font-semibold text-green-600 dark:text-green-400"
															>Available</span
														>
													{:else}
														<CloseCircleSolid class="h-4 w-4 text-red-500" />
														<span class="text-lg font-semibold text-red-600 dark:text-red-400"
															>Unavailable</span
														>
													{/if}
												</div>
											</div>
											<div class="mb-3 w-full md:mb-0 md:w-1/4">
												<span class="block text-sm font-medium text-gray-600 dark:text-gray-400"
													>Date</span
												>
												<span class="text-lg font-semibold text-gray-900 dark:text-white">
													{dayjs(trigger.triggered_at).format('MMM D, HH:mm')}
												</span>
											</div>
										</div>
									{/each}
								</div>
							</div>
						{/if}
					{:else}
						<Alert color="yellow" class="rounded-2xl">
							{#snippet icon()}
								<InfoCircleSolid class="h-4 w-4" />
							{/snippet}
							Unable to load cloud alerts data.
						</Alert>
					{/if}
				</div>
			</TabItem>
		</Tabs>
	</div>
</div>

<!-- Cloud Alert Modal -->
<CloudAlertModal
	bind:open={showCloudAlertModal}
	alert={editingCloudAlert}
	{serverTypeOptions}
	{locationOptions}
	on:close={() => {
		showCloudAlertModal = false;
		editingCloudAlert = null;
	}}
	on:success={() => invalidateAll()}
/>

<!-- Delete Confirmation Modal -->
<Modal bind:open={showDeleteModal} size="sm" autoclose={false} class="mx-auto w-full max-w-md">
	<div class="text-center">
		<ExclamationCircleSolid class="mx-auto mb-4 h-12 w-12 text-gray-400 dark:text-gray-200" />
		<h3 class="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
			Are you sure you want to delete this {deleteConfirmation.type === 'price'
				? 'price alert'
				: 'cloud alert'}?
		</h3>
		<div class="flex justify-center gap-3">
			<Button
				color="alternative"
				onclick={() => {
					showDeleteModal = false;
				}}
				disabled={deleteConfirmation.isDeleting}
			>
				Cancel
			</Button>
			<Button color="red" onclick={confirmDelete} disabled={deleteConfirmation.isDeleting}>
				{#if deleteConfirmation.isDeleting}
					<Spinner size="4" class="me-2" />
					Deleting...
				{:else}
					Delete Alert
				{/if}
			</Button>
		</div>
	</div>
</Modal>
