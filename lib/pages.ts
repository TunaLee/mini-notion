import { getDb } from "./db";
import type { Page, PageContent, PageSummary, Todo } from "./types";

// 맥에서 복사한 한글은 자모가 풀린 형태일 수 있어, 저장과 검색 모두 같은 형태(NFC)로 맞춘다.
const nfc = (text: string) => text.normalize("NFC");

export function parseContent(data: Record<string, unknown>): PageContent | null {
  const { title, body, todos } = data;
  if (typeof title !== "string" || title.length > 300) return null;
  if (typeof body !== "string" || body.length > 200_000) return null;
  if (!Array.isArray(todos) || todos.length > 500) return null;
  const clean: Todo[] = [];
  for (const todo of todos) {
    if (!todo || typeof todo.id !== "string" || typeof todo.text !== "string" || typeof todo.done !== "boolean") return null;
    if (todo.id.length > 64 || todo.text.length > 1000) return null;
    clean.push({ id: todo.id, text: nfc(todo.text), done: todo.done });
  }
  return { title: nfc(title), body: nfc(body), todos: clean };
}

const SUMMARY = "id, parent_id AS parentId, title";

export function listPages(query: string): PageSummary[] {
  const db = getDb();
  const word = nfc(query.trim());
  if (!word) return db.prepare(`SELECT ${SUMMARY} FROM pages ORDER BY id`).all() as PageSummary[];
  return db
    .prepare(
      `SELECT ${SUMMARY} FROM pages
       WHERE instr(lower(title), lower(?1)) > 0
          OR instr(lower(body), lower(?1)) > 0
          OR EXISTS (SELECT 1 FROM json_each(pages.todos)
                     WHERE instr(lower(json_extract(json_each.value, '$.text')), lower(?1)) > 0)
       ORDER BY updated_at DESC`,
    )
    .all(word) as PageSummary[];
}

export function getPage(id: number): Page | null {
  const row = getDb().prepare(`SELECT ${SUMMARY}, body, todos, version FROM pages WHERE id = ?`).get(id);
  if (!row) return null;
  return { ...row, todos: JSON.parse(row.todos as string) } as Page;
}

export function createPage(parentId: number | null, content: PageContent, userId: number): Page {
  const result = getDb()
    .prepare("INSERT INTO pages (parent_id, title, body, todos, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(parentId, content.title, content.body, JSON.stringify(content.todos), userId, Date.now());
  return getPage(Number(result.lastInsertRowid))!;
}

/** 연 뒤로 판 번호가 그대로일 때만 저장한다. 저장하지 못하면 false. */
export function updatePage(id: number, version: number, content: PageContent, userId: number): boolean {
  const result = getDb()
    .prepare(
      `UPDATE pages SET title = ?, body = ?, todos = ?, version = version + 1, updated_by = ?, updated_at = ?
       WHERE id = ? AND version = ?`,
    )
    .run(content.title, content.body, JSON.stringify(content.todos), userId, Date.now(), id, version);
  return result.changes === 1;
}

// 안에 든 글은 데이터베이스 규칙(ON DELETE CASCADE)으로 함께 지워진다.
export function deletePage(id: number): void {
  getDb().prepare("DELETE FROM pages WHERE id = ?").run(id);
}
