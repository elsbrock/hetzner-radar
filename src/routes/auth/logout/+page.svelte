<script lang="ts">
  import { faHandPeace } from "@fortawesome/free-solid-svg-icons";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { Button } from "flowbite-svelte";
</script>

<div class="flex items-center justify-center py-10 px-3">
    <div class="p-6 space-y-6 bg-white rounded-lg shadow-md dark:bg-gray-800 w-[450px]">
        <h2 class="text-2xl font-semibold text-gray-800 dark:text-white">Goodbye.</h2>
        <div class="text-center">
            <FontAwesomeIcon class="text-8xl text-gray-400
            dark:text-gray-500 mb-8 w-24 h-24" icon={faHandPeace} />
            <p class="text-gray-500 dark:text-gray-400">You have been successfully logged out.</p>
        </div>
        <div class="w-full flex justify-center">
            <Button href="/" size="sm">Go Home</Button>
        </div>
    </div>
</div>
