import { fail, readJson, requireUser } from "@/lib/api";
import { createPage, getPage, listPages, parseContent } from "@/lib/pages";

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  return Response.json({ pages: listPages(new URL(request.url).searchParams.get("q") ?? "") });
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const data = await readJson(request);
  const content = data && parseContent(data);
  if (!data || !content) return fail(400, "글 내용이 올바르지 않아요 (너무 길 수 있어요)");

  const parentId = data.parentId ?? null;
  if (parentId !== null && (typeof parentId !== "number" || !getPage(parentId))) {
    return fail(404, "윗글이 이미 지워졌어요");
  }
  return Response.json({ page: createPage(parentId, content, user.id) }, { status: 201 });
}
