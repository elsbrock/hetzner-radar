# Svelte 5 Runes Migration Cheatsheet

## ⚠️ IMPORTANT: This project uses Svelte 5 with runes mode

### Common Migration Patterns

#### 1. Props Declaration
```svelte
<!-- ❌ OLD (Svelte 4) -->
export let data;
export let user = null;
export let open = false;

<!-- ✅ NEW (Svelte 5 runes) -->
let { data } = $props();
let { user = null } = $props();
let { open = $bindable(false) } = $props(); // For two-way binding
```

#### 2. Reactive Statements
```svelte
<!-- ❌ OLD (Svelte 4) -->
$: doubledValue = value * 2;
$: if (condition) { doSomething(); }

<!-- ✅ NEW (Svelte 5 runes) -->
const doubledValue = $derived(value * 2);
$effect(() => {
    if (condition) { doSomething(); }
});
```

#### 3. State Variables
```svelte
<!-- ❌ OLD (Svelte 4) -->
let count = 0;

<!-- ✅ NEW (Svelte 5 runes) -->
let count = $state(0);
```

#### 4. Bindable Props
```svelte
<!-- ❌ OLD (Svelte 4) -->
export let open = false;

<!-- ✅ NEW (Svelte 5 runes) -->
let { open = $bindable(false) } = $props();
```

#### 5. Component Props with Types
```svelte
<!-- ❌ OLD (Svelte 4) -->
export let user: User;
export let settings: Settings = defaultSettings;

<!-- ✅ NEW (Svelte 5 runes) -->
let { 
    user,
    settings = defaultSettings 
}: {
    user: User;
    settings?: Settings;
} = $props();
```

### Quick Reference

| Svelte 4 | Svelte 5 Runes |
|----------|----------------|
| `export let prop` | `let { prop } = $props()` |
| `export let prop = defaultValue` | `let { prop = defaultValue } = $props()` |
| `bind:prop` | `let { prop = $bindable() } = $props()` |
| `$: reactive = expr` | `const reactive = $derived(expr)` |
| `$: if (condition) { }` | `$effect(() => { if (condition) { } })` |
| `let state = value` | `let state = $state(value)` |

### Always Remember:
- ✅ Use `$props()` instead of `export let`
- ✅ Use `$derived()` for computed values
- ✅ Use `$effect()` for side effects
- ✅ Use `$state()` for reactive state
- ✅ Use `$bindable()` for two-way binding props