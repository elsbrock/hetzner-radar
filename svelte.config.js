import adapter from "@sveltejs/adapter-cloudflare";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://kit.svelte.dev/docs/integrations#preprocessors
  // for more information about preprocessors
  preprocess: vitePreprocess(),

  kit: {
    /**
     * SvelteKit's built-in CSRF origin check rejects any form-encoded POST
     * whose Origin does not match, and treats a MISSING Origin as a mismatch.
     * OAuth token and client-registration requests (RFC 6749 / RFC 7591) are
     * exactly that: server-to-server, application/x-www-form-urlencoded, with
     * no Origin header. The check runs before hooks, so Better Auth never saw
     * them and MCP clients got a bare 403 from /api/auth/mcp/token.
     *
     * `trustedOrigins` cannot express the exception — a missing Origin is
     * forbidden regardless of what is trusted — so the built-in check is
     * disabled here and re-implemented in hooks.server.ts, where it can exempt
     * the OAuth endpoints alone instead of every form action in the app.
     */
    csrf: { trustedOrigins: ["*"] },
    adapter: adapter({
      prerender: false,
      routes: {
        include: ["/*"],
        exclude: ["<all>"],
      },
      config: "wrangler.jsonc",
    }),
  },
};

export default config;
