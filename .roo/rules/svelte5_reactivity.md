# Svelte 5 Reactivity Rule

**Guideline:** In Svelte 5 code, avoid using `$: ` reactive statements.

**Details:**
Prefer `$derived` for creating computed values based on other state variables and `$effect` for running side effects in response to state changes. Replace legacy `$: ` statements accordingly.

**Example:**

*   **Instead of:** `$: doubled = count * 2;`
*   **Use:** `let doubled = $derived(count * 2);`

*   **Instead of:** `$: console.log('Count changed:', count);`
*   **Use:** `$effect(() => { console.log('Count changed:', count); });`

**Applies to:** Svelte files (`.svelte`)