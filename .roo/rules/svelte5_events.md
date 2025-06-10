# Svelte 5 Event Handlers Rule

**Guideline:** In Svelte 5 code, replace `on:event` syntax with the direct `onevent` attribute.

**Details:**
When you encounter the following patterns, apply the specified replacements:

- `on:click` -> `onclick`
- `on:keydown` -> `onkeydown`
- `on:input` -> `oninput`
- `on:change` -> `onchange`
- `on:submit` -> `onsubmit`

**Applies to:** Svelte files (`.svelte`)
