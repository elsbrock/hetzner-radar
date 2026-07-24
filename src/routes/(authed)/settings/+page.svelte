<script lang="ts">
	import { session } from '$lib/stores/session';
	import { addToast } from '$lib/stores/toast';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Button, Modal, Label, Input, Checkbox, Spinner } from 'flowbite-svelte';
	import { faDiscord } from '@fortawesome/free-brands-svg-icons';
	import {
		faEnvelope,
		faFlask,
		faBell,
		faLink,
		faUser,
		faDownload,
		faTrash
	} from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import type { ActionResult } from '@sveltejs/kit';

	let { data } = $props();

	let showConfirmModal = $state(false);
	let deleteForm: HTMLFormElement | null = $state(null);
	let discordWebhookUrl = $state('');
	let discordNotifications = $state(false);
	let isTestingWebhook = $state(false);
	let webhookUrl = $state('');
	let webhookNotifications = $state(false);
	let isTestingGenericWebhook = $state(false);

	// Initialize form state from props (only on mount, not reactive to data changes)
	$effect(() => {
		discordWebhookUrl = data.user.discord_webhook_url || '';
		discordNotifications = data.user.notification_preferences.discord;
		webhookUrl = data.user.webhook_url || '';
		webhookNotifications = data.user.notification_preferences.webhook;
	});

	// Shared toast handling for the settings form actions
	function showActionToast(result: ActionResult) {
		if (result.type !== 'success' || !result.data || typeof result.data !== 'object') return;
		if ('success' in result.data && result.data.success) {
			addToast({
				color: 'green',
				message: (result.data as { message: string }).message,
				icon: 'success'
			});
		} else if ('error' in result.data) {
			addToast({
				color: 'red',
				message: (result.data as { error: string }).error,
				icon: 'error'
			});
		}
	}

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
			class="mx-auto mb-4 h-14 w-14 text-gray-400 dark:text-gray-200"
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
		<h3 class="mb-5 text-lg font-normal text-gray-500 dark:text-gray-400">
			Are you sure you want to delete your account? This action is irreversible.
		</h3>
		<Button onclick={confirmDelete} color="red" class="me-2">Yes, I'm sure</Button>
		<Button onclick={cancelDelete} color="alternative">I changed my mind</Button>
	</div>
</Modal>

<div class="px-3 py-10">
	<div class="mx-auto w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl">
		{#if $session}
			<!-- Page Header -->
			<div class="mb-8 text-center">
				<h1
					class="flex items-center justify-center text-3xl font-bold text-gray-900 dark:text-white"
				>
					<FontAwesomeIcon icon={faUser} class="mr-3 h-8 w-8 text-orange-500" />
					Account Settings
				</h1>
				<p class="mt-2 text-gray-600 dark:text-gray-300">
					Manage your account information and notification preferences
				</p>
			</div>

			<div class="space-y-6">
				<!-- Account Information Card -->
				<div
					class="rounded-lg border border-gray-200 bg-white p-6 shadow-xs dark:border-gray-700 dark:bg-gray-800"
				>
					<div class="mb-4 flex items-center">
						<FontAwesomeIcon icon={faUser} class="mr-2 h-5 w-5 text-gray-500" />
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
				<div
					class="rounded-lg border border-gray-200 bg-white p-6 shadow-xs dark:border-gray-700 dark:bg-gray-800"
				>
					<div class="mb-4 flex items-center">
						<FontAwesomeIcon icon={faBell} class="mr-2 h-5 w-5 text-gray-500" />
						<h2 class="text-xl font-semibold text-gray-900 dark:text-white">
							Notification Preferences
						</h2>
					</div>

					<p class="mb-6 text-gray-600 dark:text-gray-300">
						Configure your preferred notification method. Discord will be used if enabled and
						working, with email as automatic fallback.
					</p>

					<form
						method="POST"
						action="?/updateNotificationPreferences"
						use:enhance={() => {
							return async ({ result, update }) => {
								showActionToast(result);
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
								<FontAwesomeIcon
									icon={faEnvelope}
									class="mr-2 h-4 w-4 text-gray-600 dark:text-gray-300"
								/>
								<Label class="mb-0! font-medium">Email Notifications</Label>
								<span
									class="ml-2 rounded-sm bg-blue-100 px-2 py-1 text-xs text-blue-700 dark:bg-blue-900 dark:text-blue-300"
								>
									Always enabled
								</span>
							</div>
						</div>
						<p class="ml-6 text-sm text-gray-500 dark:text-gray-400">
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
								<FontAwesomeIcon icon={faDiscord} class="mr-2 h-4 w-4 text-indigo-500" />
								<Label class="mb-0! font-medium">Discord Notifications</Label>
								{#if !discordWebhookUrl}
									<span
										class="ml-2 rounded-sm bg-amber-100 px-2 py-1 text-xs text-amber-700 dark:bg-amber-900 dark:text-amber-300"
									>
										Setup required
									</span>
								{/if}
							</div>
						</div>
						<p class="ml-6 text-sm text-gray-500 dark:text-gray-400">
							Receive rich notifications in your Discord server
						</p>

						<div class="flex items-center space-x-3 {!webhookUrl ? 'opacity-60' : ''}">
							<Checkbox
								name="webhook_notifications"
								bind:checked={webhookNotifications}
								disabled={!webhookUrl}
								class="text-teal-500 focus:ring-teal-500"
							/>
							<div class="flex items-center">
								<FontAwesomeIcon icon={faLink} class="mr-2 h-4 w-4 text-teal-500" />
								<Label class="mb-0! font-medium">Webhook Notifications</Label>
								{#if !webhookUrl}
									<span
										class="ml-2 rounded-sm bg-amber-100 px-2 py-1 text-xs text-amber-700 dark:bg-amber-900 dark:text-amber-300"
									>
										Setup required
									</span>
								{/if}
							</div>
						</div>
						<p class="ml-6 text-sm text-gray-500 dark:text-gray-400">
							Send a JSON payload to your own endpoint for custom integrations
						</p>

						<div class="pt-2">
							<Button type="submit" color="primary">Save Preferences</Button>
						</div>
					</form>
				</div>

				<!-- Discord Configuration Card -->
				<div
					class="rounded-lg border border-gray-200 bg-white p-6 shadow-xs dark:border-gray-700 dark:bg-gray-800"
				>
					<div class="mb-4 flex items-center">
						<FontAwesomeIcon icon={faDiscord} class="mr-2 h-5 w-5 text-indigo-500" />
						<h2 class="text-xl font-semibold text-gray-900 dark:text-white">
							Discord Configuration
						</h2>
					</div>

					<div
						class="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-700 dark:bg-blue-900/20"
					>
						<h4 class="mb-2 font-medium text-blue-900 dark:text-blue-100">
							How to get a Discord webhook URL:
						</h4>
						<ol class="list-inside list-decimal space-y-1 text-sm text-blue-800 dark:text-blue-200">
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
								showActionToast(result);
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
									class="flex-1 font-mono"
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
										<FontAwesomeIcon icon={faFlask} class="mr-1 h-4 w-4" />
										Test
									{/if}
								</Button>
							</div>
							<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
								Leave empty to disable Discord notifications
							</p>
						</div>

						<div class="pt-2">
							<Button type="submit" color="primary">Save Webhook</Button>
						</div>
					</form>
				</div>

				<!-- Webhook Configuration Card -->
				<div
					class="rounded-lg border border-gray-200 bg-white p-6 shadow-xs dark:border-gray-700 dark:bg-gray-800"
				>
					<div class="mb-4 flex items-center">
						<FontAwesomeIcon icon={faLink} class="mr-2 h-5 w-5 text-teal-500" />
						<h2 class="text-xl font-semibold text-gray-900 dark:text-white">
							Webhook Configuration
						</h2>
					</div>

					<div
						class="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-700 dark:bg-blue-900/20"
					>
						<h4 class="mb-2 font-medium text-blue-900 dark:text-blue-100">
							Integrate with your own tools:
						</h4>
						<p class="text-sm text-blue-800 dark:text-blue-200">
							When an alert triggers, Server Radar sends a JSON payload via HTTP POST to the
							endpoint below — ideal for home automation, ntfy, or custom bots. Note that
							notifications are dispatched with a short random delay to keep the auction fair for
							everyone.
						</p>
					</div>

					<form
						method="POST"
						action="?/updateWebhookUrl"
						use:enhance={({ submitter }) => {
							const isTest = submitter?.getAttribute('formaction') === '?/testWebhook';
							if (isTest) {
								isTestingGenericWebhook = true;
							}
							return async ({ result, update }) => {
								if (isTest) {
									isTestingGenericWebhook = false;
								}
								showActionToast(result);
								update({ reset: false });
							};
						}}
						class="space-y-4"
					>
						<div>
							<Label for="webhook_url" class="mb-2">Webhook URL</Label>
							<div class="flex gap-2">
								<Input
									id="webhook_url"
									name="webhook_url"
									type="url"
									bind:value={webhookUrl}
									placeholder="https://example.com/hooks/server-radar"
									class="flex-1 font-mono"
								/>
								<Button
									type="submit"
									color="alternative"
									size="sm"
									disabled={!webhookUrl || isTestingGenericWebhook}
									formaction="?/testWebhook"
								>
									{#if isTestingGenericWebhook}
										<Spinner size="4" class="mr-1" />
										Test
									{:else}
										<FontAwesomeIcon icon={faFlask} class="mr-1 h-4 w-4" />
										Test
									{/if}
								</Button>
							</div>
							<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
								Must be a public HTTPS endpoint. Leave empty to disable webhook notifications.
							</p>
						</div>

						<div class="pt-2">
							<Button type="submit" color="primary">Save Webhook</Button>
						</div>
					</form>
				</div>

				<!-- Data Export Card -->
				<div
					class="rounded-lg border border-gray-200 bg-white p-6 shadow-xs dark:border-gray-700 dark:bg-gray-800"
				>
					<div class="mb-4 flex items-center">
						<FontAwesomeIcon icon={faDownload} class="mr-2 h-5 w-5 text-blue-500" />
						<h2 class="text-xl font-semibold text-gray-900 dark:text-white">Data Export</h2>
					</div>

					<p class="mb-4 text-gray-600 dark:text-gray-300">
						Download all your account information, including your profile, sessions, price alerts,
						and alert history, as a JSON file.
					</p>

					<Button href="/settings/export" color="alternative">
						<FontAwesomeIcon icon={faDownload} class="mr-2 h-4 w-4" />
						Export My Data
					</Button>
				</div>

				<!-- Danger Zone Card -->
				<div
					class="rounded-lg border border-red-200 bg-white p-6 shadow-xs dark:border-red-700 dark:bg-gray-800"
				>
					<div class="mb-4 flex items-center">
						<FontAwesomeIcon icon={faTrash} class="mr-2 h-5 w-5 text-red-500" />
						<h2 class="text-xl font-semibold text-red-600 dark:text-red-400">Danger Zone</h2>
					</div>

					<p class="mb-4 text-gray-600 dark:text-gray-300">
						Deleting your account will permanently remove all associated information, including any
						alerts you've set up. This action cannot be undone, but you're welcome to sign up again
						later.
					</p>

					<form
						bind:this={deleteForm}
						id="delete-form"
						method="POST"
						action="?/delete"
						use:enhance={() => {
							session.set(null);
							addToast({
								color: 'green',
								message: 'Account deleted successfully.',
								icon: 'success'
							});
							return goto(resolve('/'));
						}}
					>
						<!-- This form is submitted programmatically -->
					</form>
					<Button onclick={handleDeleteClick} color="red">
						<FontAwesomeIcon icon={faTrash} class="mr-2 h-4 w-4" />
						Delete My Account
					</Button>
				</div>
			</div>
		{:else}
			<div class="rounded-lg bg-gray-50 p-6 text-center dark:bg-gray-700">
				<h2 class="mb-4 text-2xl font-semibold text-gray-800 dark:text-white">Not Logged In</h2>
				<p class="mb-4 text-gray-600 dark:text-gray-300">You are not logged in.</p>
				<Button href="/auth/login">Sign In</Button>
			</div>
		{/if}
	</div>
</div>
