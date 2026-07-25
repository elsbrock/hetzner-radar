import { getRequestEvent } from "$app/server";
import { sendMail } from "$lib/mail";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { emailOTP, mcp } from "better-auth/plugins";
import { sveltekitCookies } from "better-auth/svelte-kit";

/**
 * Better Auth instance, built per D1 binding.
 *
 * On Cloudflare the D1 binding only exists at request time (`platform.env.DB`),
 * so the instance cannot live at module scope. It is memoised against the
 * binding object itself, which is stable for the lifetime of an isolate — so in
 * practice this constructs once per isolate, not once per request.
 */

/** Matches the legacy `email_verification_code` flow: 6 digits, 15 minutes. */
const OTP_LENGTH = 6;
const OTP_EXPIRY_SECONDS = 15 * 60;

/** Matches the legacy session policy: 30 day expiry, renewed at 15 days. */
const SESSION_EXPIRY_SECONDS = 60 * 60 * 24 * 30;
const SESSION_REFRESH_SECONDS = 60 * 60 * 24 * 15;

const DEFAULT_BASE_URL = "https://radar.iodev.org";

/**
 * Better Auth mounts its routes by matching the request against `baseURL`, and
 * `isAuthPath()` rejects anything whose **origin** differs. A hardcoded
 * production URL therefore 404s every /api/auth/* route on localhost and on
 * preview deployments — auth appears to vanish entirely off production.
 *
 * So: prefer an explicit BETTER_AUTH_URL, otherwise adopt the origin of the
 * request being served. The instance is memoised per D1 binding and a given
 * deployment only ever serves one origin, so resolving this once is safe.
 */
function resolveBaseUrl(env: PlatformEnv): string {
  if (env.BETTER_AUTH_URL) return env.BETTER_AUTH_URL;

  try {
    return getRequestEvent().url.origin;
  } catch {
    // Outside a request context (build, tests) there is no origin to read.
    return DEFAULT_BASE_URL;
  }
}

/**
 * `app.d.ts` hand-rolls a minimal `DB` interface that omits `exec`, so it does
 * not structurally satisfy Better Auth's `D1Database` union member. The runtime
 * object *is* a real D1Database — Better Auth detects it via `batch`/`exec`/
 * `prepare` and selects its built-in D1 dialect. This cast is types-only.
 */
type BetterAuthDatabase = NonNullable<BetterAuthOptions["database"]>;

export type Auth = ReturnType<typeof createAuth>;

const instances = new WeakMap<object, Auth>();

function createAuth(env: PlatformEnv) {
  return betterAuth({
    database: env.DB as unknown as BetterAuthDatabase,
    baseURL: resolveBaseUrl(env),
    secret: env.BETTER_AUTH_SECRET,

    // Sign-in is email OTP only — there are no passwords in this app.
    emailAndPassword: { enabled: false },

    /**
     * Column mapping. Better Auth defaults to camelCase columns; this schema is
     * snake_case throughout. The `database.casing` option is declared in Better
     * Auth's types but never read at runtime (verified in 1.6.25), so the
     * mapping has to be explicit per model.
     */
    user: {
      modelName: "user",
      fields: {
        emailVerified: "email_verified",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
    },
    session: {
      modelName: "session",
      fields: {
        userId: "user_id",
        expiresAt: "expires_at",
        ipAddress: "ip_address",
        userAgent: "user_agent",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
      expiresIn: SESSION_EXPIRY_SECONDS,
      updateAge: SESSION_REFRESH_SECONDS,
    },
    account: {
      modelName: "account",
      fields: {
        userId: "user_id",
        accountId: "account_id",
        providerId: "provider_id",
        accessToken: "access_token",
        refreshToken: "refresh_token",
        accessTokenExpiresAt: "access_token_expires_at",
        refreshTokenExpiresAt: "refresh_token_expires_at",
        idToken: "id_token",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
    },
    verification: {
      modelName: "verification",
      fields: {
        expiresAt: "expires_at",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
    },

    plugins: [
      emailOTP({
        otpLength: OTP_LENGTH,
        expiresIn: OTP_EXPIRY_SECONDS,
        // Existing users signed up without a code-based account record; allow
        // sign-in to create the account row on first use.
        disableSignUp: false,
        async sendVerificationOTP({ email, otp }) {
          await sendMail(env, {
            from: {
              name: "Server Radar",
              email: "no-reply@radar.iodev.org",
            },
            to: email,
            subject: "Your Magic Sign-In Code",
            text: `Greetings!

You've requested to sign in to Server Radar. Here's your magic code:

  ${otp}

You've got 15 minutes to use it before it expires. If you didn't request
this, just ignore this email – no action needed on your part.

Cheers,
Server Radar
--
https://radar.iodev.org/`,
          });
        },
      }),
      /**
       * Makes this app an OAuth provider for MCP clients: discovery metadata,
       * dynamic client registration and PKCE. Only the alert tools require it —
       * the read tools at /mcp stay reachable with no credentials at all.
       *
       * `resource` must identify the protected resource itself (RFC 9728), not
       * the origin. Left unset it defaults to the bare origin, and clients that
       * check the metadata against the endpoint they actually connected to
       * (/mcp) see a mismatch.
       */
      mcp({
        loginPage: "/auth/login",
        resource: `${resolveBaseUrl(env)}/mcp`,
      }),
      // Must stay last so it can observe cookies set by other plugins.
      sveltekitCookies(getRequestEvent),
    ],
  });
}

export function getAuth(env: PlatformEnv): Auth {
  const key = env.DB as unknown as object;
  const existing = instances.get(key);
  if (existing) return existing;

  const auth = createAuth(env);
  instances.set(key, auth);
  return auth;
}
