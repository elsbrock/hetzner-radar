<script lang="ts">
	import { faHandPeace } from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { Button } from 'flowbite-svelte';
</script>

<div class="flex items-center justify-center px-3 py-10">
	<div class="w-[450px] space-y-6 rounded-lg bg-white p-6 shadow-md dark:bg-gray-800">
		<h2 class="text-2xl font-semibold text-gray-800 dark:text-white">Goodbye.</h2>
		<div class="text-center">
			<FontAwesomeIcon
				class="mb-8 h-24
            w-24 text-8xl text-gray-400 dark:text-gray-500"
				icon={faHandPeace}
			/>
			<p class="text-gray-500 dark:text-gray-400">You have been successfully logged out.</p>
		</div>
		<div class="flex w-full justify-center">
			<Button href="/" size="sm">Go Home</Button>
		</div>
	</div>
</div>
