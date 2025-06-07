<script lang="ts">
    import { session } from "$lib/stores/session";
    import { addToast } from "$lib/stores/toast";
    import { enhance } from "$app/forms";
    import { goto } from "$app/navigation";
    import { Button, Modal, Label, Input, Checkbox, Card, Spinner } from "flowbite-svelte";
    import { faDiscord } from "@fortawesome/free-brands-svg-icons";
    import { faEnvelope, faFlask, faBell, faUser, faDownload, faTrash } from "@fortawesome/free-solid-svg-icons";
    import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";

    let { data } = $props();

    let showConfirmModal = $state(false);
    let deleteForm: HTMLFormElement | null = $state(null);
    let discordWebhookUrl = $state(data.user.discord_webhook_url || '');
    let discordNotifications = $state(data.user.notification_preferences.discord);
    let isTestingWebhook = $state(false);

    function handleDeleteClick() {
        showConfirmModal = true;
    }

    function confirmDelete() {
        if (deleteForm) {
            deleteForm.requestSubmit();
        }
        showConfirmModal = false;
    }

    function cancelDelete() {
        showConfirmModal = false;
    }
</script>

<Modal bind:open={showConfirmModal} size="xs" autoclose={false}>
    <div class="text-center">
        <svg
            aria-hidden="true"
            class="mx-auto mb-4 w-14 h-14 text-gray-400 dark:text-gray-200"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            ><path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path></svg
        >
        <h3
            class="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400"
        >
            Are you sure you want to delete your account? This action is
            irreversible.
        </h3>
        <Button onclick={confirmDelete} color="red" class="me-2">
            Yes, I'm sure
        </Button>
        <Button onclick={cancelDelete} color="alternative">
            I changed my mind
        </Button>
    </div>
</Modal>

<div class="py-10 px-3">
    <div class="w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl mx-auto">
        {#if $session}
            <!-- Page Header -->
            <div class="text-center mb-8">
                <h1 class="text-3xl font-bold text-gray-900 dark:text-white flex items-center justify-center">
                    <FontAwesomeIcon icon={faUser} class="w-8 h-8 mr-3 text-orange-500" />
                    Account Settings
                </h1>
                <p class="mt-2 text-gray-600 dark:text-gray-300">
                    Manage your account information and notification preferences
                </p>
            </div>

            <div class="space-y-6">
                <!-- Account Information Card -->
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <div class="flex items-center mb-4">
                        <FontAwesomeIcon icon={faUser} class="w-5 h-5 mr-2 text-gray-500" />
                        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Account Information</h2>
                    </div>
                    
                    <div class="space-y-4">
                        <div>
                            <Label for="email" class="mb-2 font-medium">Email Address</Label>
                            <Input id="email" value={data.user.email} disabled />
                            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                Your email address is used for authentication and notifications.
                            </p>
                        </div>
                    </div>
                </div>

                <!-- Notification Preferences Card -->
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <div class="flex items-center mb-4">
                        <FontAwesomeIcon icon={faBell} class="w-5 h-5 mr-2 text-gray-500" />
                        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Notification Preferences</h2>
                    </div>
                    
                    <p class="text-gray-600 dark:text-gray-300 mb-6">
                        Configure your preferred notification method. Discord will be used if enabled and working, with email as automatic fallback.
                    </p>
                    
                    <form 
                        method="POST" 
                        action="?/updateNotificationPreferences"
                        use:enhance={() => {
                            return async ({ result, update }) => {
                                if (result.type === 'success' && result.data && typeof result.data === 'object' && 'success' in result.data && result.data.success) {
                                    addToast({
                                        color: "green",
                                        message: (result.data as any).message,
                                        icon: "success",
                                    });
                                } else if (result.type === 'success' && result.data && typeof result.data === 'object' && 'error' in result.data) {
                                    addToast({
                                        color: "red",
                                        message: (result.data as any).error,
                                        icon: "error",
                                    });
                                }
                                update({ reset: false });
                            };
                        }}
                        class="space-y-4"
                    >
                        <div class="flex items-center space-x-3">
                            <Checkbox 
                                name="email_notifications" 
                                checked={true}
                                disabled
                                class="text-orange-500 focus:ring-orange-500"
                            />
                            <div class="flex items-center">
                                <FontAwesomeIcon icon={faEnvelope} class="w-4 h-4 mr-2 text-gray-600 dark:text-gray-300" />
                                <Label class="!mb-0 font-medium">Email Notifications</Label>
                                <span class="ml-2 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                                    Always enabled
                                </span>
                            </div>
                        </div>
                        <p class="text-sm text-gray-500 dark:text-gray-400 ml-6">
                            Email serves as fallback when Discord notifications fail or are disabled
                        </p>
                        
                        <div class="flex items-center space-x-3 {!discordWebhookUrl ? 'opacity-60' : ''}">
                            <Checkbox 
                                name="discord_notifications" 
                                bind:checked={discordNotifications}
                                disabled={!discordWebhookUrl}
                                class="text-indigo-500 focus:ring-indigo-500"
                            />
                            <div class="flex items-center">
                                <FontAwesomeIcon icon={faDiscord} class="w-4 h-4 mr-2 text-indigo-500" />
                                <Label class="!mb-0 font-medium">Discord Notifications</Label>
                                {#if !discordWebhookUrl}
                                    <span class="ml-2 text-xs bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 px-2 py-1 rounded">
                                        Setup required
                                    </span>
                                {/if}
                            </div>
                        </div>
                        <p class="text-sm text-gray-500 dark:text-gray-400 ml-6">
                            Receive rich notifications in your Discord server
                        </p>
                        
                        <div class="pt-2">
                            <Button type="submit" color="primary">
                                Save Preferences
                            </Button>
                        </div>
                    </form>
                </div>

                <!-- Discord Configuration Card -->
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <div class="flex items-center mb-4">
                        <FontAwesomeIcon icon={faDiscord} class="w-5 h-5 mr-2 text-indigo-500" />
                        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Discord Configuration</h2>
                    </div>
                    
                    <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-6">
                        <h4 class="font-medium text-blue-900 dark:text-blue-100 mb-2">How to get a Discord webhook URL:</h4>
                        <ol class="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
                            <li>Go to Discord server settings → Integrations → Webhooks</li>
                            <li>Click "New Webhook" and choose your notification channel</li>
                            <li>Copy the webhook URL and paste it below</li>
                        </ol>
                    </div>
                    
                    <form 
                        method="POST" 
                        action="?/updateDiscordWebhook"
                        use:enhance={({ submitter }) => {
                            const isTest = submitter?.getAttribute('formaction') === '?/testDiscordWebhook';
                            if (isTest) {
                                isTestingWebhook = true;
                            }
                            return async ({ result, update }) => {
                                if (isTest) {
                                    isTestingWebhook = false;
                                }
                                if (result.type === 'success' && result.data && typeof result.data === 'object' && 'success' in result.data && result.data.success) {
                                    addToast({
                                        color: "green",
                                        message: (result.data as any).message,
                                        icon: "success",
                                    });
                                } else if (result.type === 'success' && result.data && typeof result.data === 'object' && 'error' in result.data) {
                                    addToast({
                                        color: "red",
                                        message: (result.data as any).error,
                                        icon: "error",
                                    });
                                }
                                update({ reset: false });
                            };
                        }}
                        class="space-y-4"
                    >
                        <div>
                            <Label for="discord_webhook" class="mb-2">Discord Webhook URL</Label>
                            <div class="flex gap-2">
                                <Input 
                                    id="discord_webhook"
                                    name="discord_webhook_url"
                                    type="url"
                                    bind:value={discordWebhookUrl}
                                    placeholder="https://discord.com/api/webhooks/..."
                                    class="font-mono flex-1"
                                />
                                <Button 
                                    type="submit"
                                    color="alternative"
                                    size="sm"
                                    disabled={!discordWebhookUrl || isTestingWebhook}
                                    formaction="?/testDiscordWebhook"
                                >
                                    {#if isTestingWebhook}
                                        <Spinner size="4" class="mr-1" />
                                        Test
                                    {:else}
                                        <FontAwesomeIcon icon={faFlask} class="w-4 h-4 mr-1" />
                                        Test
                                    {/if}
                                </Button>
                            </div>
                            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                Leave empty to disable Discord notifications
                            </p>
                        </div>
                        
                        <div class="pt-2">
                            <Button type="submit" color="primary">
                                Save Webhook
                            </Button>
                        </div>
                    </form>
                </div>

                <!-- Data Export Card -->
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <div class="flex items-center mb-4">
                        <FontAwesomeIcon icon={faDownload} class="w-5 h-5 mr-2 text-blue-500" />
                        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Data Export</h2>
                    </div>
                    
                    <p class="text-gray-600 dark:text-gray-300 mb-4">
                        Download all your account information, including your profile, sessions, price alerts, and alert history, as a JSON file.
                    </p>
                    
                    <Button href="/settings/export" color="alternative">
                        <FontAwesomeIcon icon={faDownload} class="w-4 h-4 mr-2" />
                        Export My Data
                    </Button>
                </div>

                <!-- Danger Zone Card -->
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-red-200 dark:border-red-700 p-6">
                    <div class="flex items-center mb-4">
                        <FontAwesomeIcon icon={faTrash} class="w-5 h-5 mr-2 text-red-500" />
                        <h2 class="text-xl font-semibold text-red-600 dark:text-red-400">Danger Zone</h2>
                    </div>
                    
                    <p class="text-gray-600 dark:text-gray-300 mb-4">
                        Deleting your account will permanently remove all associated information, including any alerts you've set up. This action cannot be undone, but you're welcome to sign up again later.
                    </p>
                    
                    <form
                        bind:this={deleteForm}
                        id="delete-form"
                        method="POST"
                        action="?/delete"
                        use:enhance={() => {
                            session.set(null);
                            addToast({
                                color: "green",
                                message: "Account deleted successfully.",
                                icon: "success",
                            });
                            return goto("/");
                        }}
                    >
                        <!-- This form is submitted programmatically -->
                    </form>
                    <Button onclick={handleDeleteClick} color="red">
                        <FontAwesomeIcon icon={faTrash} class="w-4 h-4 mr-2" />
                        Delete My Account
                    </Button>
                </div>
            </div>
        {:else}
            <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 text-center">
                <h2 class="text-2xl font-semibold text-gray-800 dark:text-white mb-4">
                    Not Logged In
                </h2>
                <p class="text-gray-600 dark:text-gray-300 mb-4">
                    You are not logged in.
                </p>
                <Button href="/auth/login">Sign In</Button>
            </div>
        {/if}
    </div>
</div>