import { fail, readJson, sameOrigin } from "@/lib/api";
import { hashPassword, startSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail(403, "허용되지 않은 요청이에요");
  const data = await readJson(request);
  const email = typeof data?.email === "string" ? data.email.trim().toLowerCase() : "";
  const password = typeof data?.password === "string" ? data.password : "";
  if (email.length > 200 || !/^[^\s@]+@[^\s@]+$/.test(email)) return fail(400, "이메일을 확인해 주세요");
  if (password.length < 8 || password.length > 200) return fail(400, "비밀번호는 8자 이상으로 해 주세요");

  const hash = await hashPassword(password);
  const result = getDb()
    .prepare("INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?) ON CONFLICT(email) DO NOTHING")
    .run(email, hash, Date.now());
  if (result.changes === 0) return fail(409, "이미 가입한 이메일이에요");

  await startSession(Number(result.lastInsertRowid));
  return Response.json({ ok: true });
}
