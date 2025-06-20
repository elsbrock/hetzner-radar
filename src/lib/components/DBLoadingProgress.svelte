<script lang="ts">
	import { Progressbar } from 'flowbite-svelte';
	import { dbInitProgress } from '../../stores/db';
</script>

<div class="flex flex-1 flex-col bg-gray-50 px-4 lg:p-48 dark:bg-gray-900">
	<!-- Loader Container -->
	<div class="flex flex-grow items-center justify-center">
		<div class="w-full max-w-md rounded-lg bg-white p-6 shadow-md dark:bg-gray-800">
			<h2 class="mb-4 text-xl font-semibold text-gray-700 dark:text-gray-300">Hang tight</h2>
			<Progressbar progress={$dbInitProgress} labelInside animate={true} size="h-4" />
			<p class="mt-5 text-sm text-gray-500 dark:text-gray-400">
				Please wait while we initialize our data. This should only take a couple of seconds.
			</p>
		</div>
	</div>
</div>
