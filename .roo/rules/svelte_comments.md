# Svelte Comments

**Guideline:** In Svelte code, comment the markup using <!-- comment--> comments when needed, never comment on elements wrapped over multiple lines.

**Details:**

When adding a comment to Svelte markup, eg.

<Component ...>
  <p>bla</p>
</Component>

ALWAYS use <!-- comment --> style comments, never {* comment *} or React-like comments, eg.

<Component ...>
  <!-- comment -->
  <p>bla</p>
</Component>

For elements wrapped over multiple lines, do not comment at all or above that element, eg.

<ComplexComponent
  foo="bar"
>

like

<!-- comment -->
<ComplexComponent
  foo="bar"
>

**Applies to:** Svelte files (`.svelte`)