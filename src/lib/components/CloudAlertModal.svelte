<script lang="ts">
    import { 
        Modal, Label, Input, MultiSelect, Radio, Toggle, Button, Spinner 
    } from "flowbite-svelte";
    import { InfoCircleSolid } from "flowbite-svelte-icons";
    import { addToast } from "$lib/stores/toast";
    import { invalidateAll } from "$app/navigation";
    import { createEventDispatcher } from "svelte";

    let { 
        open = false,
        alert = null,
        serverTypeOptions = [],
        locationOptions = []
    }: {
        open: boolean;
        alert: any | null;
        serverTypeOptions: Array<{value: number, name: string}>;
        locationOptions: Array<{value: number, name: string}>;
    } = $props();

    const dispatch = createEventDispatcher();

    // Local modal state
    let modalOpen = $state(false);

    // Form state
    let alertName = $state('');
    let selectedServerTypeIds: number[] = $state([]);
    let selectedLocationIds: number[] = $state([]);
    let alertOn: 'available' | 'unavailable' | 'both' = $state('available');
    let emailNotifications = $state(true);
    let discordNotifications = $state(false);
    let isSubmitting = $state(false);

    // Sync parent open prop with local modal state
    $effect(() => {
        modalOpen = open;
    });

    // Watch for modal close and notify parent
    $effect(() => {
        if (!modalOpen && open) {
            // Modal was closed, notify parent
            dispatch('close');
        }
    });

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
        if (!alertName.trim() || selectedServerTypeIds.length === 0 || selectedLocationIds.length === 0) {
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
            const url = alert ? `/cloud-alerts/${alert.id}` : '/cloud-alerts';
            const method = alert ? 'PATCH' : 'POST';
            
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
                    message: alert ? 'Cloud alert updated successfully' : 'Cloud alert created successfully',
                    type: 'success',
                    dismissible: true,
                    timeout: 3000
                });
                modalOpen = false;
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
        modalOpen = false;
        resetForm();
    }
</script>

<Modal bind:open={modalOpen} size="md" autoclose={false} outsideclose={false} class="w-full max-w-lg mx-auto" style="z-index: 9999;">
    <form on:submit|preventDefault={handleSubmit} class="flex flex-col space-y-3">
        <!-- Header -->
        <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {alert ? 'Edit Cloud Alert' : 'Create Cloud Alert'}
        </h3>

        <p class="text-sm text-gray-600 dark:text-gray-300 mb-3">
            {alert ? 'Update your cloud server availability alert settings.' : 'Get notified when cloud server availability changes in your selected locations and server types.'}
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
            <MultiSelect 
                items={serverTypeOptions}
                bind:value={selectedServerTypeIds}
                placeholder="Select server types to monitor"
                required
                class="text-sm"
            />
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
                    <Radio bind:group={alertOn} value="available" class="text-orange-500 focus:ring-orange-500" />
                    <span class="text-sm text-gray-900 dark:text-white">Server becomes available</span>
                </Label>
                <Label class="flex items-center space-x-2">
                    <Radio bind:group={alertOn} value="unavailable" class="text-orange-500 focus:ring-orange-500" />
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
                <Label class="flex items-center space-x-2 p-2 border border-gray-200 dark:border-gray-600 rounded">
                    <Toggle 
                        bind:checked={emailNotifications}
                        class="text-orange-500 focus:ring-orange-500"
                    />
                    <div class="flex items-center space-x-2 flex-1">
                        <InfoCircleSolid class="w-4 h-4 text-gray-600 dark:text-gray-300" />
                        <div>
                            <div class="text-sm font-medium text-gray-900 dark:text-white">Email</div>
                            <div class="text-xs text-gray-500 dark:text-gray-400">Receive notifications via email</div>
                        </div>
                    </div>
                </Label>
                <Label class="flex items-center space-x-2 p-2 border border-gray-200 dark:border-gray-600 rounded">
                    <Toggle 
                        bind:checked={discordNotifications}
                        class="text-indigo-500 focus:ring-indigo-500"
                    />
                    <div class="flex items-center space-x-2 flex-1">
                        <InfoCircleSolid class="w-4 h-4 text-indigo-500" />
                        <div>
                            <div class="text-sm font-medium text-gray-900 dark:text-white">Discord</div>
                            <div class="text-xs text-gray-500 dark:text-gray-400">Receive rich notifications in Discord</div>
                        </div>
                    </div>
                </Label>
            </div>
            
            {#if !emailNotifications && !discordNotifications}
                <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded p-2">
                    <p class="text-xs text-red-900 dark:text-red-100">
                        Please select at least one notification method.
                    </p>
                </div>
            {/if}
        </div>

        <!-- Action Buttons -->
        <div class="flex justify-end space-x-2 pt-2">
            <Button 
                type="button"
                color="alternative" 
                size="sm"
                on:click={handleCancel}
            >
                Cancel
            </Button>
            <Button 
                type="submit" 
                color="primary" 
                size="sm"
                disabled={isSubmitting || !isFormValid}
            >
                {#if isSubmitting}
                    <Spinner size="4" class="ms-0 me-1" /> Saving
                {:else}
                    {alert ? 'Update' : 'Create'} Alert
                {/if}
            </Button>
        </div>
    </form>
</Modal>