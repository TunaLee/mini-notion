import { fail, sameOrigin } from "@/lib/api";
import { endSession } from "@/lib/auth";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail(403, "허용되지 않은 요청이에요");
  await endSession();
  return Response.json({ ok: true });
}
