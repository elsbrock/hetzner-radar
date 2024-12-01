import { generateIdFromEntropySize } from "./session";

export async function getUserId(db: any, email: string): Promise<string> {
    return db
        .prepare("SELECT id FROM user WHERE email = ?")
        .bind(email)
        .first("id");
}

export async function createUser(db: any, email: string) {
    const userId = generateIdFromEntropySize(10);
    await db
        .prepare("INSERT INTO user (id, email) VALUES (?, ?)")
        .bind(userId, email)
        .run();
    return userId;
}
