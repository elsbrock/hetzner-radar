import { alphabet, generateRandomString } from "oslo/crypto";

export async function generateEmailVerificationCode(
  db: any,
  email: string,
): Promise<string> {
  const code = generateRandomString(6, alphabet("0-9"));
  await db
    .prepare("DELETE FROM email_verification_code WHERE email = ?")
    .bind(email)
    .run();
  const insertStmt = db
    .prepare(
      `
		insert into
			email_verification_code (email, code, expires_at)
		values
			(?, ?, datetime('now', '+15 minutes'))
	`,
    )
    .bind(email, code);
  await insertStmt.run();

  return code;
}

export async function verifyCodeExists(
  db: any,
  email: string,
  code: string,
): Promise<boolean> {
  return (
    (await db
      .prepare(
        "SELECT count(*) as count FROM email_verification_code WHERE code = ? and email = ? and expires_at > datetime('now')",
      )
      .bind(code, email)
      .first("count")) === 1
  );
}

export async function deleteVerificationCodes(db: any, email: string) {
  return db
    .prepare("DELETE FROM email_verification_code WHERE email = ?")
    .bind(email)
    .run();
}

export async function deleteExpiredVerificationCodes(db: any) {
  return db
    .prepare(
      "DELETE FROM email_verification_code WHERE expires_at < datetime('now')",
    )
    .run();
}
