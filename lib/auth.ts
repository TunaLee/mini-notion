import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { getDb } from "./db";

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, length: number) => Promise<Buffer>;

const COOKIE = "session";
const SESSION_SECONDS = 60 * 60 * 24 * 30;

export type User = { id: number; email: string };

// 로그인 표는 원본 대신 지문(hash)만 저장한다. 데이터 파일이 새어도 바로 쓸 수 없다.
const fingerprint = (token: string) => createHash("sha256").update(token).digest("hex");

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 64);
  return `${salt.toString("hex")}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, key] = stored.split(":");
  const actual = await scryptAsync(password, Buffer.from(salt, "hex"), 64);
  return timingSafeEqual(actual, Buffer.from(key, "hex"));
}

export async function startSession(userId: number): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const db = getDb();
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(Date.now());
  db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(
    fingerprint(token),
    userId,
    Date.now() + SESSION_SECONDS * 1000,
  );
  // 내 컴퓨터에서 http 로 돌리므로 secure 옵션은 켜지 않는다.
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: SESSION_SECONDS });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) getDb().prepare("DELETE FROM sessions WHERE token = ?").run(fingerprint(token));
  store.delete(COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const row = getDb()
    .prepare(
      `SELECT users.id, users.email FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token = ? AND sessions.expires_at > ?`,
    )
    .get(fingerprint(token), Date.now());
  return row ? { id: row.id as number, email: row.email as string } : null;
}
