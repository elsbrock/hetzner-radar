/**
 * Name of the pre-Better-Auth session cookie.
 *
 * Sessions are handled entirely by Better Auth as of migration 0016 — nothing
 * issues or validates this cookie any more. It is still cleared on sight (hooks,
 * logout, account deletion) so stale cookies from before the cutover do not
 * linger in browsers. Safe to delete once that transition window has passed.
 */
export const SESSION_COOKIE_NAME = "sr_session";
