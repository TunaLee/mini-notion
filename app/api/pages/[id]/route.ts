import { fail, readJson, requireUser } from "@/lib/api";
import { deletePage, getPage, parseContent, updatePage } from "@/lib/pages";

type Context = { params: Promise<{ id: string }> };

const GONE = "그사이 지워진 글이에요";

export async function GET(request: Request, { params }: Context) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const page = getPage(Number((await params).id));
  return page ? Response.json({ page }) : fail(404, GONE);
}

export async function PUT(request: Request, { params }: Context) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  const id = Number((await params).id);

  const data = await readJson(request);
  const content = data && parseContent(data);
  if (!data || !content || typeof data.version !== "number") {
    return fail(400, "글 내용이 올바르지 않아요 (너무 길 수 있어요)");
  }

  const saved = updatePage(id, data.version, content, user.id);
  const page = getPage(id);
  if (!page) return fail(404, GONE);
  if (!saved) return fail(409, "그사이 다른 사람이 고쳤어요", { page });
  return Response.json({ page });
}

export async function DELETE(request: Request, { params }: Context) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  deletePage(Number((await params).id));
  return Response.json({ ok: true });
}
