import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
-- AUTOINCREMENT: 지운 글의 번호를 다시 쓰지 않는다 (겹침 판단이 헷갈리지 않게)
CREATE TABLE IF NOT EXISTS pages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id  INTEGER REFERENCES pages(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT '',
  body       TEXT NOT NULL DEFAULT '',
  todos      TEXT NOT NULL DEFAULT '[]',
  version    INTEGER NOT NULL DEFAULT 1,
  updated_by INTEGER NOT NULL REFERENCES users(id),
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS pages_parent ON pages(parent_id);
-- 로그인하지 않고 쓴 글의 '고친 사람'. 이메일 모양이 아니라 가입할 수 없고, 0 뿐인 지문이라 로그인할 수 없다.
INSERT OR IGNORE INTO users (email, password_hash, created_at)
VALUES ('guest', '${"0".repeat(32)}:${"0".repeat(128)}', 0);
`;

const globalForDb = globalThis as unknown as { db?: DatabaseSync };

export function getDb(): DatabaseSync {
  if (!globalForDb.db) {
    const file = process.env.NOTION_DB ?? path.join(process.cwd(), "data", "notion.db");
    mkdirSync(path.dirname(file), { recursive: true });
    const db = new DatabaseSync(file);
    db.exec("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    db.exec(SCHEMA);
    globalForDb.db = db;
  }
  return globalForDb.db;
}
