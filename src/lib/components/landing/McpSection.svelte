<script lang="ts">
	// Pitches the MCP server: the auction data is queryable by AI assistants,
	// publicly and without an account, with alert management once connected.
	import { faBell, faPlug, faTerminal } from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import SectionEyebrow from './SectionEyebrow.svelte';

	const MCP_URL = 'https://radar.iodev.org/mcp';

	let copied = $state(false);

	async function copyUrl() {
		try {
			await navigator.clipboard.writeText(MCP_URL);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			// Clipboard can be unavailable (permissions, insecure context); the URL
			// is selectable on screen either way, so this needs no error state.
		}
	}
</script>

<section id="mcp" class="mx-auto my-20 max-w-5xl">
	<div class="mb-12 text-center">
		<SectionEyebrow label="For AI assistants" />
		<h2 class="mt-3 mb-4 text-3xl font-semibold text-gray-800 dark:text-gray-100">
			Ask your assistant about Hetzner servers
		</h2>
		<p class="mx-auto max-w-2xl text-gray-600 dark:text-gray-400">
			Server Radar speaks the Model Context Protocol, so Claude and other MCP clients can search the
			auction directly — <em>"is there a cheap 64&nbsp;GB EPYC in Falkenstein right now?"</em> — and
			set up alerts for you once you connect your account.
		</p>
	</div>

	<div
		class="signal-edge relative overflow-hidden rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
	>
		<div
			class="radar-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(120%_100%_at_100%_0%,black,transparent)]"
		></div>

		<div class="relative grid grid-cols-1 gap-6 lg:grid-cols-3">
			<div>
				<div class="mb-2 flex items-center gap-2">
					<FontAwesomeIcon icon={faTerminal} class="h-4 w-4 text-orange-500" />
					<p class="font-medium text-gray-800 dark:text-gray-100">Search the auction</p>
				</div>
				<p class="text-sm text-gray-500 dark:text-gray-400">
					Filter by CPU, RAM, disks, location and price — the same filters as the web app, including
					when the price next drops.
				</p>
			</div>

			<div>
				<div class="mb-2 flex items-center gap-2">
					<FontAwesomeIcon icon={faBell} class="h-4 w-4 text-orange-500" />
					<p class="font-medium text-gray-800 dark:text-gray-100">Manage alerts</p>
				</div>
				<p class="text-sm text-gray-500 dark:text-gray-400">
					Connect your account and your assistant can create price alerts and Cloud availability
					alerts, then list or remove them.
				</p>
			</div>

			<div>
				<div class="mb-2 flex items-center gap-2">
					<FontAwesomeIcon icon={faPlug} class="h-4 w-4 text-orange-500" />
					<p class="font-medium text-gray-800 dark:text-gray-100">No account needed</p>
				</div>
				<p class="text-sm text-gray-500 dark:text-gray-400">
					Searching is public. Signing in is only required for alerts, and you approve access
					explicitly — revoke it any time from settings.
				</p>
			</div>
		</div>

		<div
			class="relative mt-6 flex flex-col gap-3 border-t border-gray-200 pt-5 sm:flex-row sm:items-center sm:justify-between dark:border-gray-700"
		>
			<div class="min-w-0">
				<p class="mb-1 text-xs text-gray-500 dark:text-gray-400">
					Add this URL as a custom connector:
				</p>
				<code
					class="block truncate rounded-md border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-sm text-gray-800 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
				>
					{MCP_URL}
				</code>
			</div>
			<div class="flex shrink-0 gap-2">
				<button
					type="button"
					onclick={copyUrl}
					class="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
				>
					{copied ? 'Copied' : 'Copy URL'}
				</button>
				<a
					href="/guide#mcp"
					class="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600"
				>
					How to connect
				</a>
			</div>
		</div>
	</div>
</section>
