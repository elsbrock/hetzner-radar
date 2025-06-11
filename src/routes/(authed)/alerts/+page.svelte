<script lang="ts">
    import { enhance } from "$app/forms";
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";
    import { browser } from "$app/environment";
    import AlertModal from "$lib/components/AlertModal.svelte";
    import AlertAuctionsDrawer from "$lib/components/AlertAuctionsDrawer.svelte";
    import CloudAlertModal from "$lib/components/CloudAlertModal.svelte";
    import { encodeFilter } from "$lib/filter";
    import { addToast } from "$lib/stores/toast";
    import { invalidate, invalidateAll } from "$app/navigation";
    import { MAX_ALERTS } from "$lib/api/backend/alerts.js";
    import { MAX_CLOUD_ALERTS } from "$lib/api/backend/cloud-alerts.js";
    import { page } from "$app/stores";
    import type { PriceAlert } from "$lib/api/backend/alerts";

    import dayjs from "dayjs";
    import localizedFormat from "dayjs/plugin/localizedFormat";
    import timezone from "dayjs/plugin/timezone";
    import utc from "dayjs/plugin/utc";
    dayjs.extend(localizedFormat);
    dayjs.extend(utc);
    dayjs.extend(timezone);

    import {
        Tabs, TabItem, Card, Badge, Button, Spinner, Alert, 
        Modal, Label, Input, MultiSelect, Radio, Toggle, ButtonGroup
    } from "flowbite-svelte";
    import {
        BellRingSolid, BullhornSolid, PlusOutline, PenSolid, TrashBinSolid, 
        CheckCircleSolid, CloseCircleSolid, ExclamationCircleSolid,
        SearchOutline, EyeSolid, InfoCircleSolid
    } from "flowbite-svelte-icons";
    import {
        faFire,
        faFlagCheckered,
        faMagnifyingGlass,
        faPenToSquare,
        faTrash,
        faBoxOpen,
    } from "@fortawesome/free-solid-svg-icons";
    import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";

    let { data } = $props();

    // Tabs state
    let activeTab = $state('price-alerts');
    
    // Initialize and sync with URL
    $effect(() => {
        const tabParam = $page.url.searchParams.get('tab');
        activeTab = tabParam === 'cloud-alerts' ? 'cloud-alerts' : 'price-alerts';
    });

    // Price alerts state
    let showEdit = $state(false);
    let selectedAlert = $state<PriceAlert | null>(null);
    let drawerHidden = $state(true);
    let selectedAlertId = $state<string | null>(null);
    let selectedVatRate = $state(0);

    // Cloud alerts state  
    let showCloudAlertModal = $state(false);
    let editingCloudAlert = $state(null);

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
        if (viewParam && drawerHidden) {
            try {
                const response = await fetch(`/alerts/${viewParam}/auctions`);
                
                if (!response.ok) {
                    addToast({
                        message: "Alert not found or auctions unavailable.",
                        type: "error",
                        dismissible: true,
                        timeout: 3000
                    });
                    
                    const url = new URL(window.location.href);
                    url.searchParams.delete('view');
                    goto(url.toString(), { replaceState: true, keepFocus: true });
                    return;
                }
                
                selectedAlertId = viewParam;
                selectedVatRate = 0;
                drawerHidden = false;
            } catch (err) {
                console.error("Error checking alert:", err);
                addToast({
                    message: "Failed to check alert. Please try again later.",
                    type: "error",
                    dismissible: true,
                    timeout: 3000
                });
                
                const url = new URL(window.location.href);
                url.searchParams.delete('view');
                goto(url.toString(), { replaceState: true, keepFocus: true });
            }
        }
    });
    
    // Reset selectedAlertId when drawer is closed
    $effect(() => {
        if (drawerHidden) {
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
                    type: "success",
                    message: "Alert deleted successfully.",
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

    function openCreateCloudAlertModal() {
        editingCloudAlert = null;
        showCloudAlertModal = true;
    }

    function openEditCloudAlertModal(alert: any) {
        editingCloudAlert = alert;
        showCloudAlertModal = true;
    }

    // Generate server type and location options from cloud status data
    const serverTypeOptions = $derived(
        data.cloudStatusData?.serverTypes?.map(st => ({
            value: st.id,
            name: `${st.name.toUpperCase()} - ${st.cores} Core${st.cores > 1 ? 's' : ''} / ${st.memory} GB RAM`
        })) || []
    );

    const locationOptions = $derived(
        data.cloudStatusData?.locations?.map(loc => ({
            value: loc.id,
            name: `${loc.city}, ${loc.country} (${loc.name})`
        })) || []
    );
</script>

<AlertModal
    bind:alert={selectedAlert}
    bind:open={showEdit}
    user={data.user}
    on:success={() => invalidateAll()}
/>

{#if !drawerHidden && selectedAlertId}
    <AlertAuctionsDrawer
        alertId={selectedAlertId}
        bind:hidden={drawerHidden}
        vatRate={selectedVatRate}
    />
{/if}

<div class="p-6">
    <div class="max-w-5xl mx-auto">
        <!-- Header -->
        <div class="mb-8">
            <h1 class="text-4xl font-bold text-gray-900 dark:text-white mb-2">Alert Management</h1>
            <p class="text-base text-gray-600 dark:text-gray-400">
                Monitor server prices and cloud availability with smart notifications
            </p>
        </div>

        <!-- Tabs -->
        <Tabs bind:activeTabValue={activeTab} contentClass="mt-6">
            <TabItem value="price-alerts" open={activeTab === 'price-alerts'}>
                <div slot="title" class="flex items-center gap-2">
                    <BellRingSolid class="w-4 h-4" />
                    Price Alerts
                </div>

                <div class="space-y-6">
                    <!-- Price Alerts Header -->
                    {#await data.alerts.active}
                        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <h2 class="text-2xl font-semibold text-gray-900 dark:text-white">
                                    Price Alerts
                                </h2>
                                <p class="text-gray-600 dark:text-gray-400 mt-1">
                                    Get notified when server prices drop below your target
                                </p>
                            </div>
                            <Button href="/analyze" class="rounded-xl px-6 py-3 font-medium">
                                <BellRingSolid class="w-4 h-4 mr-2" />
                                Create Price Alert
                            </Button>
                        </div>
                    {:then active}
                        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <h2 class="text-2xl font-semibold text-gray-900 dark:text-white">
                                    Price Alerts
                                </h2>
                                <p class="text-gray-600 dark:text-gray-400 mt-1">
                                    Get notified when server prices drop below your target
                                </p>
                            </div>
                            {#if active.length > 0}
                                <Button href="/analyze" class="rounded-xl px-6 py-3 font-medium">
                                    <BellRingSolid class="w-4 h-4 mr-2" />
                                    Create Price Alert
                                </Button>
                            {/if}
                        </div>
                    {/await}

                    <!-- Active Price Alerts -->
                    {#await data.alerts.active}
                        <div class="flex justify-center py-12">
                            <Spinner size="8" />
                        </div>
                    {:then active}
                        <div class="grid gap-4">
                            <div>
                                <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
                                    <FontAwesomeIcon
                                        icon={faFire}
                                        class="text-orange-500 w-5 h-5 mr-2 inline"
                                    />
                                    Active Alerts ({active.length}/{MAX_ALERTS})
                                </h3>
                                <p class="text-base text-gray-600 dark:text-gray-400 mb-4">
                                    All alerts that you have set up will be displayed here. Server Radar will continuously monitor the prices and notify you once the trigger price has been reached. You can edit or delete them at any time. New alerts can be created from existing search results (head over to <a href="/analyze" class="text-orange-500 hover:text-orange-600 underline">analyze</a>).
                                </p>
                            </div>
                            
                            {#if active.length === 0}
                                <div class="text-center bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                                    <p class="text-lg text-gray-700 dark:text-gray-300">
                                        There are no active alerts.
                                    </p>
                                    <p class="mt-2">
                                        <Button href="/analyze" color="primary" size="sm" class="shadow-sm">
                                            Create Alert
                                        </Button>
                                    </p>
                                </div>
                            {:else}
                                <div class="space-y-3">
                                    {#each active as alert}
                                        <div class="flex flex-col md:flex-row md:items-start p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border-l-4 border-l-gray-300 dark:border-l-gray-700">
                                            <div class="mb-3 md:mb-0 w-full md:w-1/3">
                                                <span class="block text-sm font-medium text-gray-600 dark:text-gray-400">Name</span>
                                                <span class="text-lg font-semibold text-gray-900 dark:text-white text-ellipsis whitespace-nowrap">
                                                    {alert.name}
                                                </span>
                                            </div>
                                            <div class="mb-3 md:mb-0 w-full md:w-1/3">
                                                <span class="block text-sm font-medium text-gray-600 dark:text-gray-400">Target Price</span>
                                                <div>
                                                    <span class="text-lg font-semibold text-gray-900 dark:text-white">
                                                        €{alert.price.toFixed(2)}
                                                    </span>
                                                    <span class="block text-xs text-gray-500 dark:text-gray-400">
                                                        (incl. {alert.vat_rate}% VAT)
                                                    </span>
                                                </div>
                                            </div>
                                            <div class="mb-3 md:mb-0 w-full md:w-1/3">
                                                <span class="block text-sm font-medium text-gray-600 dark:text-gray-400">Created</span>
                                                <span class="text-lg font-semibold text-gray-900 dark:text-white">
                                                    {dayjs.utc(alert.created_at).local().format("MMM D, YYYY")}
                                                </span>
                                            </div>
                                            <div class="mt-3 md:mt-0 self-center">
                                                <ButtonGroup>
                                                    <Button
                                                        size="xs"
                                                        href={`/analyze?filter=${encodeFilter(JSON.parse(alert.filter))}`}
                                                    >
                                                        <FontAwesomeIcon icon={faMagnifyingGlass} />
                                                    </Button>
                                                    <Button
                                                        size="xs"
                                                        on:click={() => {
                                                            selectedAlert = alert;
                                                            showEdit = true;
                                                        }}
                                                    >
                                                        <FontAwesomeIcon icon={faPenToSquare} />
                                                    </Button>
                                                    <Button 
                                                        size="xs"
                                                        on:click={() => openDeleteConfirmation('price', alert.id, alert.name)}
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
                            <ExclamationCircleSolid slot="icon" class="w-4 h-4" />
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
                                <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
                                    <FontAwesomeIcon
                                        icon={faFlagCheckered}
                                        class="text-green-500 w-5 h-5 mr-2 inline"
                                    />
                                    Recently Triggered ({triggered.length})
                                </h3>
                                <p class="text-base text-gray-600 dark:text-gray-400 mb-4">
                                    Once an alert has triggered you will be notified and it will show up here. An alert that triggered will automatically be disabled and no more notifications will be sent. You can recreate them any time. We show the last 10 triggered alerts.
                                </p>
                            </div>
                            
                            {#if triggered.length === 0}
                                <div class="text-center bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                                    <p class="text-lg text-gray-700 dark:text-gray-300">
                                        No alerts have triggered yet.
                                    </p>
                                </div>
                            {:else}
                                <div class="space-y-3">
                                    {#each triggered as alert}
                                        <div class="flex flex-col md:flex-row md:items-start p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border-l-4 border-l-green-500">
                                            <div class="mb-3 md:mb-0 w-full md:w-1/5">
                                                <span class="block text-sm font-medium text-gray-600 dark:text-gray-400">Name</span>
                                                <span class="text-lg font-semibold text-gray-900 dark:text-white text-ellipsis whitespace-nowrap">
                                                    {alert.name}
                                                </span>
                                            </div>
                                            <div class="mb-3 md:mb-0 w-full md:w-1/5">
                                                <span class="block text-sm font-medium text-gray-600 dark:text-gray-400">Target</span>
                                                <span class="text-lg font-semibold text-gray-900 dark:text-white">
                                                    €{alert.price.toFixed(2)}
                                                </span>
                                            </div>
                                            <div class="mb-3 md:mb-0 w-full md:w-1/5">
                                                <span class="block text-sm font-medium text-gray-600 dark:text-gray-400">Triggered At</span>
                                                <span class="text-lg font-semibold text-green-600 dark:text-green-400">
                                                    €{alert.trigger_price.toFixed(2)}
                                                </span>
                                            </div>
                                            <div class="mb-3 md:mb-0 w-full md:w-1/5">
                                                <span class="block text-sm font-medium text-gray-600 dark:text-gray-400">Date</span>
                                                <span class="text-lg font-semibold text-gray-900 dark:text-white">
                                                    {dayjs.utc(alert.triggered_at).local().format("MMM D, HH:mm")}
                                                </span>
                                            </div>
                                            <div class="mt-3 md:mt-0 self-center w-full md:w-1/5">
                                                <ButtonGroup>
                                                    <Button
                                                        size="xs"
                                                        href={`/analyze?filter=${encodeFilter(JSON.parse(alert.filter))}`}
                                                    >
                                                        <FontAwesomeIcon icon={faMagnifyingGlass} />
                                                    </Button>
                                                    <Button
                                                        size="xs"
                                                        on:click={async () => {
                                                            try {
                                                                const response = await fetch(`/alerts/${alert.id}/auctions`);
                                                                if (!response.ok) {
                                                                    addToast({
                                                                        message: "Alert not found or auctions unavailable.",
                                                                        type: "error",
                                                                        dismissible: true,
                                                                        timeout: 3000
                                                                    });
                                                                    return;
                                                                }
                                                                selectedAlertId = alert.id;
                                                                selectedVatRate = alert.vat_rate;
                                                                drawerHidden = false;
                                                            } catch (err) {
                                                                console.error("Error checking alert:", err);
                                                                addToast({
                                                                    message: "Failed to check alert. Please try again later.",
                                                                    type: "error",
                                                                    dismissible: true,
                                                                    timeout: 3000
                                                                });
                                                            }
                                                        }}
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
                            <ExclamationCircleSolid slot="icon" class="w-4 h-4" />
                            <strong>Error:</strong> Could not load triggered alerts.
                        </Alert>
                    {/await}
                </div>
            </TabItem>

            <TabItem value="cloud-alerts" open={activeTab === 'cloud-alerts'}>
                <div slot="title" class="flex items-center gap-2">
                    <BullhornSolid class="w-4 h-4" />
                    Cloud Alerts
                </div>

                <div class="space-y-6">
                    <!-- Cloud Alerts Header -->
                    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h2 class="text-2xl font-semibold text-gray-900 dark:text-white">Cloud Alerts</h2>
                            <p class="text-gray-600 dark:text-gray-400 mt-1">
                                Monitor cloud server availability changes in real-time
                            </p>
                        </div>
                        <Button 
                            on:click={openCreateCloudAlertModal} 
                            class="rounded-xl px-6 py-3 font-medium"
                        >
                            <BellRingSolid class="w-4 h-4 mr-2" />
                            Create Cloud Alert
                        </Button>
                    </div>

                    <!-- Active Cloud Alerts -->
                    {#if data.cloudAlerts}
                        <div class="grid gap-4">
                            <div>
                                <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
                                    <BullhornSolid class="text-blue-500 w-5 h-5 mr-2 inline" />
                                    Active Alerts ({data.cloudAlerts.activeAlerts.length}/{MAX_CLOUD_ALERTS})
                                </h3>
                                <p class="text-base text-gray-600 dark:text-gray-400 mb-4">
                                    Monitor cloud server availability changes in real-time. Server Radar will notify you when your selected server types become available or unavailable in your chosen locations. You can set up alerts for specific combinations and choose your preferred notification methods.
                                </p>
                            </div>
                            
                            {#if data.cloudAlerts.activeAlerts.length === 0}
                                <div class="text-center bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                                    <p class="text-lg text-gray-700 dark:text-gray-300">
                                        There are no active cloud alerts.
                                    </p>
                                    <p class="mt-2">
                                        <Button on:click={openCreateCloudAlertModal} color="primary" size="sm" class="shadow-sm">
                                            Create Alert
                                        </Button>
                                    </p>
                                </div>
                            {:else}
                                <div class="space-y-3">
                                    {#each data.cloudAlerts.activeAlerts as alert}
                                        <div class="flex flex-col md:flex-row md:items-start p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border-l-4 border-l-blue-500">
                                            <div class="mb-3 md:mb-0 w-full md:w-1/5">
                                                <span class="block text-sm font-medium text-gray-600 dark:text-gray-400">Name</span>
                                                <span class="text-lg font-semibold text-gray-900 dark:text-white text-ellipsis whitespace-nowrap">
                                                    {alert.name}
                                                </span>
                                            </div>
                                            <div class="mb-3 md:mb-0 w-full md:w-1/5">
                                                <span class="block text-sm font-medium text-gray-600 dark:text-gray-400">Alert Type</span>
                                                <Badge 
                                                    color={alert.alert_on === 'available' ? 'green' : alert.alert_on === 'unavailable' ? 'red' : 'yellow'}
                                                    class="text-xs"
                                                >
                                                    {alert.alert_on}
                                                </Badge>
                                            </div>
                                            <div class="mb-3 md:mb-0 w-full md:w-1/5">
                                                <span class="block text-sm font-medium text-gray-600 dark:text-gray-400">Server Types</span>
                                                <div class="flex flex-wrap gap-1">
                                                    {#each alert.server_type_ids.slice(0, 2) as typeId}
                                                        {@const serverType = serverTypeOptions.find(st => st.value === typeId)}
                                                        {#if serverType}
                                                            <Badge color="blue" class="text-xs">
                                                                {serverType.name.split(' - ')[0]}
                                                            </Badge>
                                                        {/if}
                                                    {/each}
                                                    {#if alert.server_type_ids.length > 2}
                                                        <Badge color="gray" class="text-xs">+{alert.server_type_ids.length - 2}</Badge>
                                                    {/if}
                                                </div>
                                            </div>
                                            <div class="mb-3 md:mb-0 w-full md:w-1/5">
                                                <span class="block text-sm font-medium text-gray-600 dark:text-gray-400">Locations</span>
                                                <div class="flex flex-wrap gap-1">
                                                    {#each alert.location_ids.slice(0, 2) as locId}
                                                        {@const location = locationOptions.find(loc => loc.value === locId)}
                                                        {#if location}
                                                            <Badge color="purple" class="text-xs">
                                                                {(location.name.split(' (')[1]?.replace(')', '') || location.name).toUpperCase()}
                                                            </Badge>
                                                        {/if}
                                                    {/each}
                                                    {#if alert.location_ids.length > 2}
                                                        <Badge color="gray" class="text-xs">+{alert.location_ids.length - 2}</Badge>
                                                    {/if}
                                                </div>
                                            </div>
                                            <div class="mb-3 md:mb-0 w-full md:w-1/5">
                                                <span class="block text-sm font-medium text-gray-600 dark:text-gray-400">Notifications</span>
                                                <div class="flex items-center gap-2 text-sm">
                                                    {#if alert.email_notifications}
                                                        <div class="flex items-center gap-1">
                                                            <CheckCircleSolid class="w-3 h-3 text-green-500" />
                                                            <span class="text-gray-900 dark:text-white">Email</span>
                                                        </div>
                                                    {/if}
                                                    {#if alert.discord_notifications}
                                                        <div class="flex items-center gap-1">
                                                            <CheckCircleSolid class="w-3 h-3 text-blue-500" />
                                                            <span class="text-gray-900 dark:text-white">Discord</span>
                                                        </div>
                                                    {/if}
                                                </div>
                                            </div>
                                            <div class="mt-3 md:mt-0 self-center">
                                                <ButtonGroup>
                                                    <Button
                                                        size="xs"
                                                        on:click={() => openEditCloudAlertModal(alert)}
                                                    >
                                                        <PenSolid class="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        size="xs"
                                                        on:click={() => openDeleteConfirmation('cloud', alert.id, alert.name)}
                                                    >
                                                        <TrashBinSolid class="w-4 h-4" />
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
                                    <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
                                        <CheckCircleSolid class="text-green-500 w-5 h-5 mr-2 inline" />
                                        Recent Triggers ({data.cloudAlerts.triggeredAlerts.length})
                                    </h3>
                                    <p class="text-base text-gray-600 dark:text-gray-400 mb-4">
                                        Cloud availability changes that have triggered your alerts are shown here. Unlike price alerts, cloud alerts remain active and will continue to notify you of future availability changes. We show the most recent triggers.
                                    </p>
                                </div>
                                
                                <div class="space-y-3">
                                    {#each data.cloudAlerts.triggeredAlerts.slice(0, 10) as trigger}
                                        <div class="flex flex-col md:flex-row md:items-start p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border-l-4 {trigger.event_type === 'available' ? 'border-l-green-500' : 'border-l-red-500'}">
                                            <div class="mb-3 md:mb-0 w-full md:w-1/4">
                                                <span class="block text-sm font-medium text-gray-600 dark:text-gray-400">Server Type</span>
                                                <span class="text-lg font-semibold text-gray-900 dark:text-white">
                                                    {trigger.server_type_name.toUpperCase()}
                                                </span>
                                            </div>
                                            <div class="mb-3 md:mb-0 w-full md:w-1/4">
                                                <span class="block text-sm font-medium text-gray-600 dark:text-gray-400">Location</span>
                                                <span class="text-lg font-semibold text-gray-900 dark:text-white">
                                                    {trigger.location_name.toUpperCase()}
                                                </span>
                                            </div>
                                            <div class="mb-3 md:mb-0 w-full md:w-1/4">
                                                <span class="block text-sm font-medium text-gray-600 dark:text-gray-400">Status</span>
                                                <div class="flex items-center gap-2">
                                                    {#if trigger.event_type === 'available'}
                                                        <CheckCircleSolid class="w-4 h-4 text-green-500" />
                                                        <span class="text-lg font-semibold text-green-600 dark:text-green-400">Available</span>
                                                    {:else}
                                                        <CloseCircleSolid class="w-4 h-4 text-red-500" />
                                                        <span class="text-lg font-semibold text-red-600 dark:text-red-400">Unavailable</span>
                                                    {/if}
                                                </div>
                                            </div>
                                            <div class="mb-3 md:mb-0 w-full md:w-1/4">
                                                <span class="block text-sm font-medium text-gray-600 dark:text-gray-400">Date</span>
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
                            <InfoCircleSolid slot="icon" class="w-4 h-4" />
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
    on:close={() => { showCloudAlertModal = false; editingCloudAlert = null; }}
    on:success={() => invalidateAll()}
/>

<!-- Delete Confirmation Modal -->
<Modal bind:open={showDeleteModal} size="sm" autoclose={false} class="w-full max-w-md mx-auto">
    <div class="text-center">
        <ExclamationCircleSolid class="mx-auto mb-4 text-gray-400 w-12 h-12 dark:text-gray-200" />
        <h3 class="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
            Are you sure you want to delete this {deleteConfirmation.type === 'price' ? 'price alert' : 'cloud alert'}?
        </h3>
        <div class="flex justify-center gap-3">
            <Button 
                color="alternative" 
                on:click={() => { showDeleteModal = false; }}
                disabled={deleteConfirmation.isDeleting}
            >
                Cancel
            </Button>
            <Button 
                color="red" 
                on:click={confirmDelete}
                disabled={deleteConfirmation.isDeleting}
            >
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