# SvelteKit RequestEvent Typing Rule

**Guideline:** Ensure correct typing for route parameters in SvelteKit endpoint handlers.

**Details:**
When defining server-side endpoint handlers (e.g., in `+server.ts` files) in SvelteKit, if you destructure `params` from the function argument, you must explicitly type the argument as `RequestEvent`.

- **Incorrect:** `export async function GET({ params }) { ... }`
- **Correct:** `export async function GET({ params }: RequestEvent) { ... }`

Ensure all endpoint handlers follow this pattern for proper type safety.

**Applies to:** SvelteKit endpoint files (typically `+server.ts` or `+server.js`).
