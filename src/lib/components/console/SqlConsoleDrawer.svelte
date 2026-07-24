<script lang="ts">
	import { Drawer, Button, CloseButton, Progressbar } from 'flowbite-svelte';
	import { sineIn } from 'svelte/easing';
	import { onMount, tick } from 'svelte';
	import { FontAwesomeIcon as Fa } from '@fortawesome/svelte-fontawesome';
	import {
		faPlay,
		faTrash,
		faDownload,
		faCopy,
		faPen,
		faDatabase,
		faTable,
		faChevronDown,
		faChevronRight,
		faCircleExclamation
	} from '@fortawesome/free-solid-svg-icons';
	import CodeEditor from './CodeEditor.svelte';
	import { db, dbInitProgress, initializeDB } from '../../../stores/db';
	import { addToast } from '$lib/stores/toast';
	import { settingsStore, currentCurrency } from '$lib/stores/settings';
	import { vatOptions } from '$lib/components/VatSelector.svelte';
	import { convertPrice } from '$lib/currency';
	import { HETZNER_IPV4_COST_CENTS } from '$lib/constants';
	import {
		runConsoleQuery,
		getSchema,
		type ConsoleResult,
		type TableSchema
	} from '$lib/api/frontend/console';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	interface ReplEntry {
		id: number;
		sql: string;
		status: 'ok' | 'error';
		result?: ConsoleResult;
		error?: string;
	}

	const EXAMPLES: { label: string; sql: string }[] = [
		{
			label: 'Available now (cheapest)',
			sql: 'SELECT cpu, ram_gb, disk_gb, price, datacenter, link\nFROM available\nORDER BY price\nLIMIT 25'
		},
		{
			label: 'Best multicore per price',
			sql: 'SELECT cpu, cpu_multicore_score, price,\n       ROUND(cpu_multicore_score / price, 1) AS score_per_unit, link\nFROM available\nWHERE cpu_multicore_score > 0\nORDER BY score_per_unit DESC\nLIMIT 25'
		},
		{
			label: 'Cheapest 64GB+ ECC',
			sql: 'SELECT cpu, ram_gb, ecc, price, datacenter, link\nFROM available\nWHERE ram_gb >= 64 AND ecc\nORDER BY price\nLIMIT 25'
		},
		{
			label: 'Price history (30d)',
			sql: "SELECT date_trunc('day', seen) AS day, ROUND(MIN(price), 2) AS cheapest\nFROM server_history\nWHERE cpu ILIKE '%Ryzen%'\nGROUP BY day\nORDER BY day"
		}
	];

	const DUCKDB_DOCS = 'https://duckdb.org/docs/stable/sql/introduction';

	const HISTORY_KEY = 'sql-console-history';

	let queryText = $state('');
	let entries = $state<ReplEntry[]>([]);
	let running = $state(false);
	let schema = $state<TableSchema[]>([]);
	let schemaReady = $state(false);
	let schemaOpen = $state(true);
	let history = $state<string[]>([]);
	let scrollback = $state<HTMLDivElement | undefined>();
	let entryCounter = 0;

	const transitionParams = { x: 480, duration: 200, easing: sineIn };

	let dbReady = $derived(!!$db);
	let schemaMap = $derived(
		Object.fromEntries(schema.map((t) => [t.name, t.columns.map((c) => c.name)]))
	);

	// View pricing mirrors the rest of the app: VAT from the selected country and
	// the chosen display currency. Recompute when either changes so the views can
	// be rebuilt with up-to-date figures.
	let viewSettings = $derived.by(() => {
		const countryCode = $settingsStore?.vatSelection?.countryCode ?? 'NET';
		const vatRate =
			countryCode in vatOptions ? vatOptions[countryCode as keyof typeof vatOptions].rate : 0;
		return {
			vatRate,
			currency: $currentCurrency,
			exchangeRate: convertPrice(1, 'EUR', $currentCurrency),
			ipv4CostCents: HETZNER_IPV4_COST_CENTS
		};
	});

	onMount(() => {
		try {
			history = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
		} catch {
			history = [];
		}
	});

	// When the drawer is open and the DB is ready, (re)build the denormalized views
	// from the current settings, then refresh the schema. Re-runs whenever the VAT
	// country or currency changes so the views stay in sync with the rest of the app.
	$effect(() => {
		if (!open) return;
		const database = $db;
		if (!database) {
			initializeDB();
			return;
		}
		const settings = viewSettings; // track VAT/currency changes
		let cancelled = false;
		getSchema(database, settings)
			.then((s) => {
				if (!cancelled) schema = s;
			})
			.catch(() => {})
			.finally(() => {
				if (!cancelled) schemaReady = true;
			});
		return () => {
			cancelled = true;
		};
	});

	function pushHistory(sql: string) {
		history = [sql, ...history.filter((h) => h !== sql)].slice(0, 30);
		try {
			localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
		} catch {
			/* ignore quota / private mode */
		}
	}

	async function run() {
		const sql = queryText.trim();
		if (!sql || running) return;
		const database = $db;
		if (!database) {
			addToast({ message: 'Database is still loading…', type: 'error' });
			return;
		}
		running = true;
		const id = ++entryCounter;
		pushHistory(sql);
		try {
			const result = await runConsoleQuery(database, sql, {
				rowLimit: 1000,
				viewSettings
			});
			entries = [...entries, { id, sql, status: 'ok', result }];
		} catch (e) {
			entries = [
				...entries,
				{ id, sql, status: 'error', error: e instanceof Error ? e.message : String(e) }
			];
		} finally {
			running = false;
			await tick();
			if (scrollback) scrollback.scrollTop = scrollback.scrollHeight;
		}
	}

	function loadIntoEditor(sql: string) {
		queryText = sql;
	}

	function runExample(sql: string) {
		queryText = sql;
		run();
	}

	function clearScrollback() {
		entries = [];
	}

	function formatCell(v: unknown): string {
		if (v === null || v === undefined) return 'NULL';
		if (typeof v === 'object') return JSON.stringify(v);
		return String(v);
	}

	function isUrl(v: unknown): v is string {
		return typeof v === 'string' && /^https?:\/\//.test(v);
	}

	function toCSV(result: ConsoleResult): string {
		const esc = (v: unknown) => {
			const s =
				v === null || v === undefined
					? ''
					: typeof v === 'object'
						? JSON.stringify(v)
						: String(v);
			return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
		};
		const header = result.columns.map(esc).join(',');
		const lines = result.rows.map((r) => result.columns.map((c) => esc(r[c])).join(','));
		return [header, ...lines].join('\n');
	}

	function download(filename: string, text: string, mime: string) {
		const blob = new Blob([text], { type: mime });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	}

	async function copyJSON(result: ConsoleResult) {
		try {
			await navigator.clipboard.writeText(JSON.stringify(result.rows, null, 2));
			addToast({ message: 'Copied result JSON to clipboard', type: 'success' });
		} catch {
			addToast({ message: 'Could not copy to clipboard', type: 'error' });
		}
	}
</script>

<Drawer
	bind:open
	placement="right"
	{transitionParams}
	id="sql-console-drawer"
	class="w-full border-l border-gray-200 bg-white sm:w-[40rem] lg:w-[52rem] dark:border-gray-700 dark:bg-gray-800"
	outsideclose={true}
	dismissable={false}
>
	<div class="flex h-full flex-col">
		<!-- Header -->
		<div class="mb-3 flex items-start justify-between gap-2">
			<div class="min-w-0">
				<h3 class="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-gray-50">
					<Fa icon={faDatabase} class="h-4 w-4 text-primary-600 dark:text-primary-400" />
					SQL Console
				</h3>
				<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
					Query the auction dataset directly — read-only, runs entirely in your browser.
				</p>
			</div>
			<CloseButton
				onclick={() => (open = false)}
				class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
			/>
		</div>

		<!-- Schema browser -->
		<div class="mb-3 rounded-lg border border-gray-200 dark:border-gray-700">
			<button
				type="button"
				class="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300"
				onclick={() => (schemaOpen = !schemaOpen)}
			>
				<span class="flex items-center gap-2">
					<Fa icon={faTable} class="h-3 w-3" />
					Schema
				</span>
				<Fa icon={schemaOpen ? faChevronDown : faChevronRight} class="h-3 w-3" />
			</button>
			{#if schemaOpen}
				<div class="max-h-40 overflow-auto border-t border-gray-200 px-3 py-2 dark:border-gray-700">
					{#if !schemaReady}
						<p class="text-xs text-gray-400">Loading schema…</p>
					{:else if schema.length === 0}
						<p class="text-xs text-gray-400">No tables found.</p>
					{:else}
						{#each schema as table (table.name)}
							<div class="mb-2 last:mb-0">
								<button
									type="button"
									class="font-mono text-xs font-semibold text-primary-700 hover:underline dark:text-primary-400"
									onclick={() => loadIntoEditor(`SELECT * FROM ${table.name} LIMIT 10`)}
									title="Load a starter query"
								>
									{table.name}
								</button>
								<div class="mt-1 flex flex-wrap gap-1">
									{#each table.columns as col (col.name)}
										<span
											class="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-600 dark:bg-gray-700 dark:text-gray-400"
											title={col.type}>{col.name}</span
										>
									{/each}
								</div>
							</div>
						{/each}
					{/if}
				</div>
			{/if}
		</div>

		<!-- Scrollback (REPL output) -->
		<div bind:this={scrollback} class="min-h-0 flex-1 space-y-3 overflow-auto">
			{#if entries.length === 0}
				<div class="rounded-lg border border-dashed border-gray-200 p-4 dark:border-gray-700">
					<p class="mb-3 text-xs text-gray-600 dark:text-gray-300">
						Query <span
							class="rounded bg-gray-100 px-1 font-mono text-[10px] dark:bg-gray-700">available</span
						>
						for current listings (with an order
						<span
							class="rounded bg-gray-100 px-1 font-mono text-[10px] dark:bg-gray-700">link</span
						>) or
						<span
							class="rounded bg-gray-100 px-1 font-mono text-[10px] dark:bg-gray-700"
							>server_history</span
						>
						for prices over time. The <span
							class="rounded bg-gray-100 px-1 font-mono text-[10px] dark:bg-gray-700">price</span
						> column includes IPv4 + your VAT in your selected currency.
					</p>
					<p class="mb-2 text-xs text-gray-500 dark:text-gray-400">Try an example:</p>
					<div class="flex flex-wrap gap-2">
						{#each EXAMPLES as ex (ex.label)}
							<button
								type="button"
								class="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:border-primary-400 hover:text-primary-700 dark:border-gray-700 dark:text-gray-300 dark:hover:text-primary-400"
								onclick={() => runExample(ex.sql)}
							>
								{ex.label}
							</button>
						{/each}
					</div>
					{#if history.length > 0}
						<p class="mt-4 mb-2 text-xs text-gray-500 dark:text-gray-400">Recent queries:</p>
						<div class="space-y-1">
							{#each history.slice(0, 8) as h (h)}
								<button
									type="button"
									class="block w-full truncate rounded px-2 py-1 text-left font-mono text-[11px] text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
									title={h}
									onclick={() => loadIntoEditor(h)}>{h.replace(/\s+/g, ' ')}</button
								>
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			{#each entries as entry (entry.id)}
				<div class="rounded-lg border border-gray-200 dark:border-gray-700">
					<!-- Echoed query -->
					<div
						class="flex items-start justify-between gap-2 border-b border-gray-100 bg-gray-50 px-3 py-1.5 dark:border-gray-700 dark:bg-gray-700/50"
					>
						<pre
							class="overflow-x-auto font-mono text-[11px] whitespace-pre-wrap text-gray-600 dark:text-gray-300">{entry.sql}</pre>
						<button
							type="button"
							class="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
							title="Edit in console"
							onclick={() => loadIntoEditor(entry.sql)}
						>
							<Fa icon={faPen} class="h-3 w-3" />
						</button>
					</div>

					{#if entry.status === 'error'}
						<div
							class="flex items-start gap-2 px-3 py-2 text-xs text-red-600 dark:text-red-400"
						>
							<Fa icon={faCircleExclamation} class="mt-0.5 h-3 w-3 shrink-0" />
							<span class="font-mono break-words">{entry.error}</span>
						</div>
					{:else if entry.result}
						<div class="px-3 py-2">
							<div class="mb-1.5 flex items-center justify-between">
								<span class="text-[11px] text-gray-500 dark:text-gray-400">
									{entry.result.rowCount}
									{entry.result.rowCount === 1 ? 'row' : 'rows'}
									{#if entry.result.truncated}<span class="text-amber-600 dark:text-amber-400"
											> (capped at 1000)</span
										>{/if}
									· {entry.result.timingMs.toFixed(0)} ms
								</span>
								<div class="flex items-center gap-2">
									<button
										type="button"
										class="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
										onclick={() => copyJSON(entry.result!)}
									>
										<Fa icon={faCopy} class="h-3 w-3" /> Copy
									</button>
									<button
										type="button"
										class="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
										onclick={() =>
											download(`query-${entry.id}.csv`, toCSV(entry.result!), 'text/csv')}
									>
										<Fa icon={faDownload} class="h-3 w-3" /> CSV
									</button>
								</div>
							</div>
							{#if entry.result.columns.length === 0}
								<p class="text-xs text-gray-400">Query returned no columns.</p>
							{:else}
								<div class="max-h-80 overflow-auto rounded border border-gray-200 dark:border-gray-700">
									<table class="w-full border-collapse text-left text-[11px]">
										<thead
											class="sticky top-0 bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
										>
											<tr>
												{#each entry.result.columns as col (col)}
													<th class="px-2 py-1 font-mono font-medium whitespace-nowrap">{col}</th>
												{/each}
											</tr>
										</thead>
										<tbody>
											{#each entry.result.rows as row, i (i)}
												<tr class="border-t border-gray-100 dark:border-gray-700">
													{#each entry.result.columns as col (col)}
														<td
															class="max-w-xs truncate px-2 py-1 font-mono whitespace-nowrap text-gray-700 dark:text-gray-300"
															title={formatCell(row[col])}
														>
															{#if isUrl(row[col])}
																<a
																	href={row[col]}
																	target="_blank"
																	rel="noopener noreferrer"
																	class="text-primary-600 hover:underline dark:text-primary-400"
																	>{formatCell(row[col])}</a
																>
															{:else}
																{formatCell(row[col])}
															{/if}
														</td>
													{/each}
												</tr>
											{/each}
										</tbody>
									</table>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>

		<!-- Editor + actions -->
		<div class="mt-3 border-t border-gray-200 pt-3 dark:border-gray-700">
			{#if !dbReady}
				<div class="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
					<p class="mb-2 text-xs text-gray-500 dark:text-gray-400">Loading dataset…</p>
					<Progressbar progress={$dbInitProgress} animate={true} size="h-2" />
				</div>
			{:else}
				<div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
					{#key schemaReady}
						<CodeEditor
							bind:value={queryText}
							onRun={run}
							schema={schemaMap}
							placeholder="SELECT … — press ⌘/Ctrl+Enter to run"
							minHeight="5rem"
						/>
					{/key}
				</div>
				<div class="mt-2 flex items-center justify-between">
					<span class="text-[11px] text-gray-400">
						Read-only · ⌘/Ctrl+Enter · capped at 1000 rows ·
						<a
							href={DUCKDB_DOCS}
							target="_blank"
							rel="noopener noreferrer"
							class="underline hover:text-gray-600 dark:hover:text-gray-300">DuckDB SQL ↗</a
						>
					</span>
					<div class="flex items-center gap-2">
						{#if entries.length > 0}
							<Button size="xs" color="alternative" onclick={clearScrollback}>
								<Fa icon={faTrash} class="me-1 h-3 w-3" /> Clear
							</Button>
						{/if}
						<Button size="xs" color="primary" disabled={running} onclick={run}>
							<Fa icon={faPlay} class="me-1 h-3 w-3" />
							{running ? 'Running…' : 'Run'}
						</Button>
					</div>
				</div>
			{/if}
		</div>
	</div>
</Drawer>
