import { sha256 } from "@oslojs/crypto/sha2";
import {
  encodeBase32LowerCaseNoPadding,
  encodeHexLowerCase,
} from "@oslojs/encoding";

export const SESSION_COOKIE_NAME = "sr_session";
const SESSION_EXPIRY = 1000 * 60 * 60 * 24 * 30;
const SESSION_RENEWAL_THRESHOLD = 1000 * 60 * 60 * 24 * 15;

export type SessionValidationResult =
  | { session: Session; user: User }
  | { session: null; user: null };

export interface Session {
  id: string;
  userId: string;
  email: string | undefined;
  expiresAt: Date;
}

export function generateSessionToken(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  const token = encodeBase32LowerCaseNoPadding(bytes);
  return token;
}

export function generateIdFromEntropySize(size: number): string {
  const buffer = crypto.getRandomValues(new Uint8Array(size));
  return encodeBase32LowerCaseNoPadding(buffer);
}

export interface User {
  id: number;
  email: string | undefined;
}

export async function createSession(
  db: any,
  token: string,
  userId: string,
  email: string,
): Promise<Session> {
  console.log("create session", token, userId);

  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));

  // Set expiration to 30 days from now in UTC
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY);

  const session: Session = {
    id: sessionId,
    userId,
    email,
    expiresAt,
  };

  console.log("create session", session);

  // Store expiresAt as ISO string in UTC
  await db
    .prepare(`INSERT INTO session (id, user_id, expires_at) VALUES (?, ?, ?)`)
    .bind(session.id, session.userId, session.expiresAt.toISOString())
    .run();

  return session;
}

export async function validateSessionToken(
  db: any,
  token: string,
): Promise<SessionValidationResult> {
  // Probabilistic cleanup: Run on ~1% of requests
  if (Math.random() < 0.01) {
    // Adjust probability as needed (0.01 = 1%)
    console.log("Attempting probabilistic cleanup of expired sessions...");
    try {
      // Use 'await' as DB operations are async
      const cleanupResult = await db
        .prepare("DELETE FROM session WHERE expires_at < ?")
        .bind(new Date().toISOString()) // Compare against current time
        .run();
      console.log(`Cleaned up ${cleanupResult.changes ?? 0} expired sessions.`);
    } catch (error) {
      // Log error but allow validation to continue
      console.error("Error during probabilistic session cleanup:", error);
    }
  }
  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
  console.log("Validating session ID:", sessionId);

  const row = await db
    .prepare(
      `SELECT session.id, session.user_id, session.expires_at, user.email
             FROM session
             INNER JOIN user ON user.id = session.user_id
             WHERE session.id = ?`,
    )
    .bind(sessionId)
    .first();

  console.log("validate session token", row);

  if (row === null) {
    console.log("Session not found");
    return { session: null, user: null };
  }

  // Parse expires_at from ISO string to Date object
  const expiresAt = new Date(row.expires_at);

  const session: Session = {
    id: row.id,
    userId: row.user_id,
    email: row.email,
    expiresAt,
  };

  const user: User = {
    id: row.user_id,
    email: row.email,
  };

  const now = new Date();

  if (now >= session.expiresAt) {
    console.log("Session expired");
    await db.prepare("DELETE FROM session WHERE id = ?").bind(session.id).run();
    return { session: null, user: null };
  }

  // Define renewal threshold (e.g., 15 days before expiration)
  const renewalThreshold = SESSION_RENEWAL_THRESHOLD; // 15 days in milliseconds

  if (session.expiresAt.getTime() - now.getTime() <= renewalThreshold) {
    console.log("Session nearing expiration, renewing");

    // Renew the session by extending it by another 30 days from now
    const newExpiresAt = new Date(Date.now() + SESSION_EXPIRY);
    session.expiresAt = newExpiresAt;

    // Update the database with the new expires_at in ISO string format
    await db
      .prepare(`UPDATE session SET expires_at = ? WHERE id = ?`)
      .bind(session.expiresAt.toISOString(), session.id)
      .run();
  }

  return { session, user };
}

export async function invalidateSession(
  db: any,
  sessionId: string,
): Promise<void> {
  await db.prepare("DELETE FROM session WHERE id = ?").bind(sessionId).run();
}
