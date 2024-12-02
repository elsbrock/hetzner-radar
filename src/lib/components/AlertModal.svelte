<script lang="ts">
    import { enhance } from "$app/forms";
    import { invalidate } from "$app/navigation";
    import { MAX_ALERTS, MAX_NAME_LENGTH } from "$lib/api/backend/alerts";
    import { filter } from "$lib/stores/filter";
    import { session } from "$lib/stores/session";
    import { addToast } from "$lib/stores/toast";
    import {
        A,
        Alert,
        Button,
        Input,
        Label,
        Modal,
        Spinner,
    } from "flowbite-svelte";
    import { createEventDispatcher } from "svelte";

    export let alert: any = null;
    export let open = false;

    let loading = false;
    let error: string;
    const dispatch = createEventDispatcher();

    let action = "/alerts?/add";
    $: if (alert) {
        action = "/alerts?/edit";
    }
</script>

<Modal
    bind:open
    size="md"
    autoclose={false}
    outsideclose
    class="w-full max-w-md mx-auto"
>
    {#if $session}
        <form
            class="flex flex-col space-y-4"
            method="POST"
            {action}
            use:enhance={() => {
                loading = true;
                return async ({ result }) => {
                    loading = false;
                    if (result.data?.success) {
                        open = false;
                        if (alert) {
                            addToast({
                                color: "green",
                                message: "Alert updated successfully.",
                                icon: "success",
                            });
                        } else {
                            addToast({
                                color: "green",
                                message: "Alert set up successfully.",
                                icon: "success",
                            });
                        }
                        invalidate("/alerts");
                        dispatch("success");
                    } else {
                        error = result.data.error;
                    }
                };
            }}
        >
            <!-- Header -->
            <h3 class="text-2xl font-semibold text-gray-900 dark:text-white">
                {#if alert}Edit Price Alert{:else}Set Up a Price Alert{/if}
            </h3>

            {#if !alert}
                <p class="text-sm text-gray-600 dark:text-gray-300">
                    Get notified when the price of this configuration drops
                    below your desired monthly price. You will receive a single
                    email notification, and the alert will automatically disable
                    itself afterwards.
                </p>
                <p class="text-sm text-gray-600 dark:text-gray-300">
                    Manage all your alerts anytime in the <A href="/alerts"
                        >Alerts</A
                    > section.
                    <span class="font-semibold"
                        >Note that you can store a maximum of {MAX_ALERTS} active
                        alerts.</span
                    >
                </p>
            {/if}

            <input type="hidden" name="alertId" value={alert?.id} />
            <input
                type="hidden"
                name="filter"
                value={JSON.stringify(alert ? alert.filter : $filter)}
            />

            <Label class="flex flex-col space-y-1">
                <span
                    class="text-sm font-medium text-gray-700 dark:text-gray-300"
                    >Name</span
                >
                <Input
                    type="text"
                    name="name"
                    placeholder="Backup Server"
                    maxlength={MAX_NAME_LENGTH}
                    required
                    value={alert?.name}
                    class="px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
            </Label>

            <!-- Price Input -->
            <Label class="flex flex-col space-y-1">
                <span
                    class="text-sm font-medium text-gray-700 dark:text-gray-300"
                    >Desired Monthly Price (EUR)</span
                >
                <Input
                    type="tel"
                    name="price"
                    placeholder="e.g., 50"
                    required
                    min="30"
                    max="1000"
                    value={alert?.price}
                    class="px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
            </Label>

            <!-- Error -->
            {#if error}
                <Alert><strong>Error:</strong> {error}</Alert>
            {/if}

            <!-- Action Buttons -->
            <div class="flex justify-end space-x-2">
                <Button
                    type="button"
                    color="gray"
                    on:click={() => (open = false)}
                >
                    Cancel
                </Button>
                <Button type="submit" color="primary" disabled={loading}>
                    {#if loading}
                        <Spinner size="4" class="ms-0 me-2" /> Saving
                    {:else}
                        Save Alert
                    {/if}
                </Button>
            </div>
        </form>
    {:else}
        <h3 class="text-2xl font-semibold text-gray-900 dark:text-white">
            Sign In to Set Up Alerts
        </h3>

        <!-- Description -->
        <p class="text-sm text-gray-600 dark:text-gray-300">
            We can notify you about your target price.
        </p>
        <p class="text-sm text-gray-600 dark:text-gray-300">
            You need to be signed in to set up price alerts. No sign-up
            required, just enter your email address, and we will send you a
            magic code to sign in.
        </p>
        <Button href="/auth/login" color="primary" class="w-full">
            Sign In
        </Button>
    {/if}
</Modal>
