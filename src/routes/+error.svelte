<script lang="ts">
    import { page } from "$app/stores";
    import { faBug, faCircleQuestion } from "@fortawesome/free-solid-svg-icons";
    import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
    import { A } from "flowbite-svelte";
</script>

<div class="flex items-center justify-center bg-gray-50 py-10 px-3">
    <div class="p-6 bg-white rounded-lg shadow-md dark:bg-gray w-[450px]">
        {#if $page.status === 500}
            <h2 class="text-2xl font-semibold text-gray-800 dark:text-white">
                Server Error
            </h2>
            <div class="text-center">
                <FontAwesomeIcon
                    class="text-8xl text-gray-400 dark:text-gray-500 my-8"
                    icon={faBug}
                />
            </div>
            <p class="text-gray-500 dark:text-gray-400">
                Uh-oh! It seems you have hit a bug. Please consider <A
                    href="https://github.com/elsbrock/hetzner-radar/issues/new"
                    >reporting</A
                > it. We will do our best to fix it. Thank you.
            </p>
        {:else}
            <h2 class="text-2xl font-semibold text-gray-800 dark:text-white">
                Not Found
            </h2>
            <div class="text-center">
                <FontAwesomeIcon
                    class="text-8xl text-gray-400 dark:text-gray-500 my-8"
                    icon={faCircleQuestion}
                />
            </div>
            <p class="text-gray-500 dark:text-gray-400">
                The page you are looking for does not exist. Please consider <A
                    href="https://github.com/elsbrock/hetzner-radar/issues/new"
                    >reporting</A
                > this in case you have followed a link on this page. Thank you.
            </p>
        {/if}
    </div>
</div>
