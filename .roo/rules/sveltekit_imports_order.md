# SvelteKit Import Order Rule

**Guideline:** Maintain a consistent import order in SvelteKit projects.

**Details:**
Imports from application-specific modules (typically located under `$lib`) should appear _before_ imports from the SvelteKit framework (`@sveltejs/kit`).

- **Correct Order Example:**

  ```typescript
  import { someUtil } from '$lib/utils';
  import { error } from '@sveltejs/kit';
  ```

- **Incorrect Order Example:**
  ```typescript
  import { error } from '@sveltejs/kit';
  import { someUtil } from '$lib/utils';
  ```

Please adjust import statements to follow this convention for better code organization and readability.

**Applies to:** Svelte (`.svelte`), TypeScript (`.ts`), and JavaScript (`.js`) files within a SvelteKit project.
