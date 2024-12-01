<script lang="ts">
    import type { ServerConfiguration } from "$lib/api/frontend/filter";
    import { getHetznerLink } from "$lib/filter";
    import { Button, Modal } from "flowbite-svelte";

	export let open = false;
	export let config: ServerConfiguration;
	let accepted = false;
</script>

<Modal title="Before You Go…" bind:open autoclose outsideclose>
	<p class="text-base leading-relaxed text-gray-500 dark:text-gray-400">
		You will be forwarded to a preconfigured Hetzner Server Auction search.
	</p>
	<p class="text-base leading-relaxed text-gray-500 dark:text-gray-400">
		Please note that this search may return multiple results or none, depending
		on availability. Ensure that the server specifications meet your needs.
	</p>
	<p class="text-base leading-relaxed text-gray-500 dark:text-gray-400 font-semibold">
		Also, prices shown on Server Radar exclude VAT, which varies by country.
		Hetzner typically includes VAT automatically, so the final price will be
		higher if you're within the European Union.
	</p>
	<p class="text-base leading-relaxed text-gray-500 dark:text-gray-400">
		This disclaimer will only show once per session.
	</p>
	<svelte:fragment slot="footer">
		<Button on:click={() => {
			accepted = true;
			open = false;
		}} type="submit" href="{getHetznerLink(config)}">
			I understand, take me there
		</Button>
	</svelte:fragment>
</Modal>
