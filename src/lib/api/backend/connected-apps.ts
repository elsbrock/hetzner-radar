/**
 * Applications the user has connected over OAuth (MCP clients).
 *
 * These tables are owned by Better Auth's mcp plugin and use camelCase, unlike
 * the rest of the schema — see migration 0017 for why they could not be mapped.
 */

export interface ConnectedApp {
  clientId: string;
  name: string;
  /** Distinct scopes granted across that client's live tokens. */
  scopes: string[];
  /** Most recent authorization. */
  authorizedAt: string;
  /** Whether any non-expired access token remains. */
  active: boolean;
  tokenCount: number;
}

type Row = {
  clientId: string;
  name: string | null;
  scopes: string | null;
  authorizedAt: string;
  expiresAt: string | null;
  tokenCount: number;
};

/**
 * Lists connected applications, newest first.
 *
 * Grouped by client rather than by token: a client refreshing its token would
 * otherwise appear as a growing list of identical entries.
 */
export async function getConnectedApps(
  db: DB,
  userId: string,
): Promise<ConnectedApp[]> {
  // Union of tokens and consent, because the two can exist independently: a
  // client that has been approved but has not yet exchanged its authorization
  // code has consent and no token, and listing only tokens would leave that
  // grant invisible — and therefore impossible to revoke. Conversely a token
  // can outlive the consent row.
  const result = await db
    .prepare(
      `SELECT g.clientId                     AS clientId,
              app.name                       AS name,
              group_concat(DISTINCT g.scopes) AS scopes,
              max(g.authorizedAt)            AS authorizedAt,
              max(g.expiresAt)               AS expiresAt,
              sum(g.isToken)                 AS tokenCount
       FROM (
         SELECT clientId, scopes, createdAt AS authorizedAt,
                accessTokenExpiresAt AS expiresAt, 1 AS isToken
         FROM oauthAccessToken WHERE userId = ?
         UNION ALL
         SELECT clientId, scopes, createdAt AS authorizedAt,
                NULL AS expiresAt, 0 AS isToken
         FROM oauthConsent WHERE userId = ? AND consentGiven = 1
       ) g
       LEFT JOIN oauthApplication app ON app.clientId = g.clientId
       GROUP BY g.clientId, app.name
       ORDER BY authorizedAt DESC`,
    )
    .bind(userId, userId)
    .all<Row>();

  const now = Date.now();

  return (result.results ?? []).map((row) => ({
    clientId: row.clientId,
    // Names come from open dynamic registration, so this is untrusted text and
    // must be rendered as such.
    name: row.name ?? "Unknown application",
    scopes: (row.scopes ?? "")
      .split(",")
      .flatMap((s) => s.split(" "))
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s, i, all) => all.indexOf(s) === i),
    authorizedAt: row.authorizedAt,
    active: !!row.expiresAt && Date.parse(row.expiresAt) > now,
    tokenCount: row.tokenCount,
  }));
}

/**
 * Revokes a client's access for one user.
 *
 * Deletes the tokens and the recorded consent, so a later authorization has to
 * be approved again rather than silently resumed. Scoped by user_id, so one
 * account cannot revoke another's grants. The `oauthApplication` row is left
 * alone — it may be shared with other users.
 */
export async function revokeConnectedApp(
  db: DB,
  userId: string,
  clientId: string,
): Promise<void> {
  await db.batch([
    db
      .prepare("DELETE FROM oauthAccessToken WHERE userId = ? AND clientId = ?")
      .bind(userId, clientId),
    db
      .prepare("DELETE FROM oauthConsent WHERE userId = ? AND clientId = ?")
      .bind(userId, clientId),
  ]);
}
