# Svelte 5 Runes Usage Rule

**Guideline:** In Svelte 5 code, utilize runes for props (`$props`), reactive state (`$state`), and bindable props (`$bindable`) instead of legacy Svelte 4 syntax.

**Details:**

1.  **Props (`$props` vs `export let`):**

    - Define component properties using the `$props()` rune.
    - Optionally, define a `$$Props` interface for type safety.
    - **Instead of (Svelte 4):**
      ```typescript
      // Svelte 4
      export let name: string = "world";
      export let count: number;
      export let open: boolean = false;
      ```
    - **Use (Svelte 5):**
      ```typescript
      // Svelte 5
      interface $$Props {
        name?: string;
        count: number; // Required prop
        open?: boolean;
      }
      let {
        name = "world",
        count, // Required, no default
        open = $bindable(false), // Use $bindable for two-way binding
      } = $props<$$Props>();
      ```
      _Note: The `<$$Props>` type argument is optional if TypeScript can infer types._

2.  **Reactive State (`$state` vs `let`):**

    - Declare local variables that need to trigger reactivity upon assignment using `$state()`.
    - Plain `let` variables are not reactive in runes mode.
    - **Instead of (Svelte 4 - reactivity triggered implicitly):**
      ```typescript
      // Svelte 4 (implicit reactivity)
      let count = 0;
      function increment() {
        count += 1; // Component updates
      }
      ```
    - **Use (Svelte 5):**

      ```typescript
      // Svelte 5
      let count = $state(0);
      function increment() {
        count += 1; // Component updates because count is $state
      }

      let nonReactive = 0;
      function nonReactiveUpdate() {
        nonReactive += 1; // This assignment WON'T trigger updates
      }
      ```

3.  **Bindable Props (`$bindable`):**
    - When a parent component needs two-way binding (`bind:propName`) with a child component's prop, declare that prop with `$bindable()` in the child.
    - **Child Component (Svelte 5):**
      ```typescript
      // Child.svelte
      let { value = $bindable(0) } = $props<{ value?: number }>();
      ```
    - **Parent Component (Svelte 5):**
      ```typescript
      // Parent.svelte
      import Child from "./Child.svelte";
      let parentValue = $state(10);
      ```
      ```svelte
      <Child bind:value={parentValue} /><p>Parent value: {parentValue}</p>
      ```

**Summary:**

- Replace `export let` with `$props()`.
- Replace reactive `let` variables with `$state()`.
- Use `$bindable()` for props intended for two-way binding.
- Continue using `$derived()` and `$effect()` as per the `svelte5_reactivity.md` rule.

**Applies to:** Svelte files (`.svelte`) using runes mode.
