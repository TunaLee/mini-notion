import { currentUser, guestId } from "./auth";

export const fail = (status: number, error: string, extra: object = {}) =>
  Response.json({ error, ...extra }, { status });

// 다른 사이트가 내 로그인을 빌려 요청을 보내지 못하게, 같은 주소에서 온 요청만 받는다.
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const data: unknown = await request.json();
    return data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** 로그인하지 않아도 통과시키고, 고친 사람으로 적을 번호를 돌려준다. 다른 사이트의 요청이면 Response 를 돌려준다. */
export async function requireActor(request: Request): Promise<number | Response> {
  if (!sameOrigin(request)) return fail(403, "허용되지 않은 요청이에요");
  return (await currentUser())?.id ?? guestId();
}
