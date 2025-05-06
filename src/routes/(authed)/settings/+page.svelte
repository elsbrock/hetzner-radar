<script lang="ts">
    import { session } from "$lib/stores/session";
    import { addToast } from "$lib/stores/toast";
    import { enhance } from "$app/forms";
    import { goto } from "$app/navigation";
    import { Button, Modal, Alert, Label, Input } from "flowbite-svelte";

    let showConfirmModal = $state(false);
    let deleteForm: HTMLFormElement | null = $state(null);

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

<div class="flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-10 px-3">
    <div
        class="p-6 bg-white rounded-lg shadow-md dark:bg-gray-800 w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl"
    >
        {#if $session}
            <h2 class="text-2xl font-semibold text-gray-800 dark:text-white mb-4">Account Info</h2>
            <p class="text-gray-800 dark:text-gray-300 mb-4">
                This is your account information. We do not store any personal
                information other than your email address.
            </p>
            <div class="mb-6">
                <Label for="email" class="block text-gray-800 dark:text-gray-100 mb-2">Email Address</Label>
                <Input id="email" value={$session.email} disabled />
            </div>
            <p class="text-gray-800 dark:text-gray-300 mb-4">
                Your email address is used to alert you about price changes and
                to send you notifications about your account.
            </p>
<hr class="my-4 border-gray-200 dark:border-gray-700" />
            <div>
                <h2 class="text-base font-semibold text-gray-800 dark:text-white mb-4">Data Export</h2>
                <p class="text-gray-800 dark:text-gray-300 mb-4">
                    You can download all your account information, including your profile, sessions, price alerts, and alert history, as a JSON file.
                </p>
                <div class="mb-6">
                    <Button href="/settings/export" color="alternative">Export My Data</Button>
                </div>
            </div>
            <hr class="my-4 border-gray-200 dark:border-gray-700" />
            <p class="text-base font-semibold text-red-600 dark:text-red-500 mb-2">Danger Zone</p>
            <p class="text-gray-800 dark:text-gray-300 mb-4">
                Deleting your account will permanently remove all associated information, including any alerts you've set up. This action cannot be undone, but you're welcome to sign up again later.
            </p>
            <form
                bind:this={deleteForm}
                id="delete-form"
                class=""
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
            <Button onclick={handleDeleteClick} color="red"
                >Delete My Account</Button
            >
        {:else}
            <h2 class="text-2xl font-semibold text-gray-800 dark:text-white">
                Not Logged In
            </h2>
            <p class="text-gray-800 dark:text-gray-300">
                You are not logged in.
            </p>
            <Button href="/auth/login" size="sm">Sign In</Button>
        {/if}
    </div>
</div>
