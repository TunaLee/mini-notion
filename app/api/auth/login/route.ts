import { fail, readJson, sameOrigin } from "@/lib/api";
import { startSession, verifyPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail(403, "허용되지 않은 요청이에요");
  const data = await readJson(request);
  const email = typeof data?.email === "string" ? data.email.trim().toLowerCase() : "";
  const password = typeof data?.password === "string" ? data.password : "";

  const user = getDb().prepare("SELECT id, password_hash FROM users WHERE email = ?").get(email);
  if (!user || password.length > 200 || !(await verifyPassword(password, user.password_hash as string))) {
    return fail(401, "이메일 또는 비밀번호가 맞지 않아요");
  }

  await startSession(user.id as number);
  return Response.json({ ok: true });
}
