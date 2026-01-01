<script lang="ts">
	import { faDiscord } from '@fortawesome/free-brands-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { Button } from 'flowbite-svelte';
</script>

<section id="community" class="mx-auto my-20 max-w-4xl">
	<div class="text-center">
		<h2 class="mb-4 text-4xl font-semibold text-gray-800 dark:text-gray-100">Discord</h2>
		<p class="mx-auto mb-8 max-w-2xl text-gray-600 dark:text-gray-400">
			Join the Discord server to discuss server deals, get help with configuration questions, or
			share feedback about the project.
		</p>
		<Button href="https://discord.gg/dcuGfURbdc" size="lg" class="shadow-sm" color="primary">
			<FontAwesomeIcon icon={faDiscord} class="mr-2" />
			Join Discord
		</Button>
	</div>
</section>
