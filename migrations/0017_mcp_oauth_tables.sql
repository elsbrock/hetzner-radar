-- OAuth provider tables for the public MCP server.
--
-- Better Auth's `mcp` plugin turns this app into an OAuth 2.1 provider so MCP
-- clients can connect an account and manage alerts. The public read tools at
-- /mcp need none of this — they work with no credentials at all.
--
-- Schema taken from better-auth 1.6.25's own getMigrations() with the mcp
-- plugin enabled, diffed against the post-0016 schema.
--
-- NOTE ON CASING: these three tables are camelCase, unlike the rest of the
-- schema. MCPOptions exposes only { loginPage, resource, oidcConfig } — there is
-- no schema/fields override for plugin tables, so the names cannot be mapped
-- the way user/session/account/verification were in 0016. They are entirely
-- Better-Auth-internal (no application code queries them), so the inconsistency
-- is contained. Renaming would mean fighting the library for no benefit.

CREATE TABLE oauthApplication (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT,
  metadata TEXT,
  clientId TEXT NOT NULL UNIQUE,
  clientSecret TEXT,
  redirectUrls TEXT NOT NULL,
  type TEXT NOT NULL,
  disabled INTEGER,
  userId TEXT REFERENCES user (id) ON DELETE CASCADE,
  createdAt DATE NOT NULL,
  updatedAt DATE NOT NULL
);

CREATE TABLE oauthAccessToken (
  id TEXT NOT NULL PRIMARY KEY,
  accessToken TEXT NOT NULL UNIQUE,
  refreshToken TEXT NOT NULL UNIQUE,
  accessTokenExpiresAt DATE NOT NULL,
  refreshTokenExpiresAt DATE NOT NULL,
  clientId TEXT NOT NULL REFERENCES oauthApplication (clientId) ON DELETE CASCADE,
  userId TEXT REFERENCES user (id) ON DELETE CASCADE,
  scopes TEXT NOT NULL,
  createdAt DATE NOT NULL,
  updatedAt DATE NOT NULL
);

CREATE TABLE oauthConsent (
  id TEXT NOT NULL PRIMARY KEY,
  clientId TEXT NOT NULL REFERENCES oauthApplication (clientId) ON DELETE CASCADE,
  userId TEXT NOT NULL REFERENCES user (id) ON DELETE CASCADE,
  scopes TEXT NOT NULL,
  createdAt DATE NOT NULL,
  updatedAt DATE NOT NULL,
  consentGiven INTEGER NOT NULL
);

CREATE INDEX oauthApplication_userId_idx ON oauthApplication (userId);
CREATE INDEX oauthAccessToken_clientId_idx ON oauthAccessToken (clientId);
CREATE INDEX oauthAccessToken_userId_idx ON oauthAccessToken (userId);
CREATE INDEX oauthConsent_clientId_idx ON oauthConsent (clientId);
CREATE INDEX oauthConsent_userId_idx ON oauthConsent (userId);
