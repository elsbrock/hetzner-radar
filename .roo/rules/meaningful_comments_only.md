# Meaningful Comments Only Rule

**Guideline:** Write comments that provide genuine value, avoiding redundancy and focusing on clarity for complex or non-obvious code sections. Discourage comments that merely restate the code, track version history, or explain trivial constructs.

**Details:**
When adding or modifying code, follow these commenting guidelines:

1.  **Prioritize Code Clarity:** Strive to write self-documenting code first. Comments should supplement clear code, not compensate for unclear code.
2.  **Avoid Redundant Comments:**
    - **Do not** add comments that simply restate what the code does (e.g., `// Initialize variable x to 0` for `let x = 0;`).
    - **Do not** add comments to track changes (e.g., `// Added function foo`). Use version control (Git).
    - **Do not** add comments explaining basic language syntax or standard library functions unless usage is complex/non-standard.
    - **Do not** add comments that only state the file path.
    - **Avoid** purely decorative comments unless they significantly improve readability in very long files.
3.  **Focus on Valuable Comments:** Add comments when they provide necessary context or explanation not obvious from the code:
    - **Explain the 'Why':** Comment on reasoning behind design decisions, algorithms, or workarounds.
    - **Clarify Complex Logic:** Explain intricate algorithms, business rules, or state transitions.
    - **Provide Context:** Explain external system dependencies, assumptions, or caveats.
    - **Document Public APIs/Interfaces:** Use JSDoc/TSDoc for exported functions, classes, types (purpose, params, returns).
    - **Mark TODOs/FIXMEs:** Use standard markers (`// TODO:`, `// FIXME:`, `// HACK:`, `// NOTE:`) with brief explanations.
4.  **Maintain Comments:** Ensure existing comments remain accurate when modifying code. Update or remove outdated comments.
5.  **Be Concise:** Write clear, brief comments.

**Example Evaluation:**

- `// Loop through users` (Bad - trivial)
- `// Added user processing logic` (Bad - version tracking)
- `// HACK: Workaround for upstream API bug XYZ-123. Remove when fixed.` (Good - 'why' and context)
- `// Using a Set here for O(1) lookups during reconciliation` (Good - 'why' for performance)
- `// TODO: Refactor this to use the new service class` (Good - actionable marker)
- `// worker/src/index.ts` (Bad - redundant path)
- `// Sort for consistency` (Marginal - okay if reason isn't obvious)

**Applies to:** All code files (e.g., `.ts`, `.js`, `.svelte`).
