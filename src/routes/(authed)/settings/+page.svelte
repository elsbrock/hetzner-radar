<script lang="ts">
    import { enhance } from "$app/forms";
    import { Button } from "flowbite-svelte";
    import { Alert, Label, Input } from "flowbite-svelte";
    import { goto } from "$app/navigation";
    import { session } from "$lib/stores/session";
    import { addToast } from "$lib/stores/toast";
</script>

<div class="flex items-center justify-center bg-gray-50 py-10 px-3">
    <div
        class="p-6 space-y-6 bg-white rounded-lg shadow-md dark:bg-gray w-[450px]"
    >
        {#if $session}
            <h2 class="text-2xl font-semibolddark:text-white">Account Info</h2>
            <p class="text-gray-800 dark:text-gray-400">
                This is your account information. We do not store any personal
                information other than your email address.
            </p>
            <div class="mb-6">
                <Label for="email" class="block text-gray-800 mb-2">Email Address</Label>
                <Input id="email" value={$session.email} disabled />
            </div>
            <p class="text-gray-800 dark:text-gray-400">
                Your email address is used to alert you about price changes and
                to send you notifications about your account.
            </p>
            <Alert class="p-2"
                ><span class="font-semibold">Danger Zone:</span> When deleting your account any information associated
                to it (such as alerts) will be deleted too. This action is irreversible.
                You may sign up again any time.</Alert
            >
            <form
                class="my-2"
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
                <Button type="submit" class="w-full"
                    >I Understand, Delete My Account</Button
                >
            </form>
        {:else}
            <h2 class="text-2xl font-semibold text-gray-800 dark:text-white">
                Not Logged In
            </h2>
            <p class="text-gray-800 dark:text-gray-400">
                You are not logged in.
            </p>
            <Button href="/auth/login" size="sm">Sign In</Button>
        {/if}
    </div>
</div>
