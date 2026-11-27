"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Page, PageContent, PageSummary } from "@/lib/types";
import Todos from "./todos";
import Tree, { countInside, label } from "./tree";

const REFRESH_MS = 5000;
const EMPTY: PageContent = { title: "", body: "", todos: [] };

const contentOf = ({ title, body, todos }: PageContent): PageContent => ({ title, body, todos });
const same = (a: PageContent, b: PageContent) => JSON.stringify(contentOf(a)) === JSON.stringify(contentOf(b));

/** 겹침 알림: 다른 사람이 고쳤거나(changed), 지운(deleted) 경우 */
type Conflict = { kind: "changed"; latest: Page } | { kind: "deleted" };

async function api(url: string, method = "GET", body?: object) {
  const response = await fetch(url, {
    method,
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  return { status: response.status, ok: response.ok, data };
}

export default function Notes({ email }: { email: string | null }) {
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ query: string; pages: PageSummary[] } | null>(null);
  const [saved, setSaved] = useState<Page | null>(null); // 서버에 저장된 모습
  const [draft, setDraft] = useState<PageContent>(EMPTY); // 지금 화면의 모습
  const [closed, setClosed] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const working = useRef(false);

  const dirty = saved !== null && !same(saved, draft);
  const word = query.trim();

  const refresh = useCallback(async () => {
    try {
      const all = await api("/api/pages");
      if (all.ok) setPages(all.data.pages);
      if (word) {
        const found = await api(`/api/pages?q=${encodeURIComponent(word)}`);
        if (found.ok) setResults({ query: word, pages: found.data.pages });
      }
    } catch {
      // 잠깐 연결이 끊겨도 다음 차례에 다시 시도한다.
    }
  }, [word]);

  // 팀원이 저장한 글이 새로고침 없이 나타나도록 주기적으로 목록을 다시 받는다.
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  /** 서버 작업은 한 번에 하나만 한다. */
  async function run(task: () => Promise<void>) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setMessage("");
    try {
      await task();
    } catch {
      setMessage("서버에 연결하지 못했어요. 잠시 뒤 다시 해 주세요.");
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  const canLeave = () => !dirty || window.confirm("저장하지 않고 나갈까요?");

  function show(page: Page | null) {
    setSaved(page);
    setDraft(page ? contentOf(page) : EMPTY);
    setConflict(null);
  }

  function open(id: number) {
    if (working.current || !canLeave()) return;
    run(async () => {
      const { ok, data } = await api(`/api/pages/${id}`);
      if (ok) show(data.page);
      else {
        show(null);
        setMessage(data.error);
        await refresh();
      }
    });
  }

  function create(parentId: number | null) {
    if (working.current || !canLeave()) return;
    run(async () => {
      const { ok, data } = await api("/api/pages", "POST", { ...EMPTY, parentId });
      if (ok) {
        show(data.page);
        setQuery("");
        if (parentId !== null) setClosed((set) => new Set([...set].filter((id) => id !== parentId)));
      } else setMessage(data.error);
      await refresh();
    });
  }

  function save(version?: number) {
    if (!saved) return;
    const id = saved.id;
    const sent = draft;
    run(async () => {
      const { status, ok, data } = await api(`/api/pages/${id}`, "PUT", { ...sent, version: version ?? saved.version });
      if (ok) {
        setSaved(data.page);
        // 저장하는 동안 더 친 글자는 그대로 둔다.
        setDraft((now) => (same(now, sent) ? contentOf(data.page) : now));
        setConflict(null);
        setMessage("저장했어요");
        await refresh();
      } else if (status === 409) setConflict({ kind: "changed", latest: data.page });
      else if (status === 404) setConflict({ kind: "deleted" });
      else setMessage(data.error);
    });
  }

  function saveAsNew() {
    if (!saved) return;
    const parentId = saved.parentId;
    run(async () => {
      let result = await api("/api/pages", "POST", { ...draft, parentId });
      // 윗글까지 지워졌으면 맨 위에 만든다.
      if (result.status === 404) result = await api("/api/pages", "POST", { ...draft, parentId: null });
      if (result.ok) {
        show(result.data.page);
        setMessage("새 글로 저장했어요");
      } else setMessage(result.data.error);
      await refresh();
    });
  }

  function remove() {
    if (!saved) return;
    const { id } = saved;
    run(async () => {
      // 그사이 안에 글이 늘었을 수 있으니 최신 목록으로 센다.
      const list = await api("/api/pages");
      if (!list.ok) return setMessage(list.data.error);
      const inside = countInside(list.data.pages, id);
      const question = inside
        ? `이 글을 지우면 안에 든 글 ${inside}개도 함께 지워져요. 지울까요?`
        : "이 글을 지울까요?";
      if (!window.confirm(`${question}\n지운 글은 되살릴 수 없어요.`)) return;
      const { ok, data } = await api(`/api/pages/${id}`, "DELETE");
      if (ok) show(null);
      else setMessage(data.error);
      await refresh();
    });
  }

  function logout() {
    if (!canLeave()) return;
    run(async () => {
      await api("/api/auth/logout", "POST");
      setSaved(null); // 나갈 때 다시 묻지 않도록
      setDraft(EMPTY);
      setTimeout(() => window.location.assign("/"));
    });
  }

  const toggle = (id: number) =>
    setClosed((set) => {
      const next = new Set(set);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const found = results?.query === word ? results.pages : null;

  return (
    <div className="app">
      <aside>
        <input type="search" aria-label="검색" placeholder="검색" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button className="link" onClick={() => create(null)} disabled={busy}>+ 새 글</button>
        <nav>
          {!word ? (
            <Tree pages={pages} selectedId={saved?.id ?? null} closed={closed} onToggle={toggle} onOpen={open} />
          ) : found === null ? (
            <p className="hint">찾는 중…</p>
          ) : found.length === 0 ? (
            <p className="hint">찾은 글이 없어요</p>
          ) : (
            <ul>
              {found.map((page) => (
                <li key={page.id}>
                  <div className={page.id === saved?.id ? "row selected" : "row"}>
                    <button className="title" onClick={() => open(page.id)}>{label(page.title)}</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </nav>
        <p className="hint email">{email ?? "로그인하지 않고 쓰는 중"}</p>
        {email ? (
          <button className="link" onClick={logout}>로그아웃</button>
        ) : (
          // 전체 이동이라야 저장하지 않은 글이 있을 때 브라우저가 한 번 묻는다.
          <a className="link" href="/login">로그인</a>
        )}
      </aside>

      <main>
        {message && <p className="message" role="status">{message}</p>}
        {!saved ? (
          <p className="hint">왼쪽에서 글을 고르거나 새 글을 만드세요.</p>
        ) : (
          <>
            <div className="head">
              <input
                className="page-title"
                aria-label="제목"
                placeholder="제목"
                maxLength={300}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
              <button className="primary" onClick={() => save()} disabled={busy}>저장</button>
            </div>
            <p className="hint">{dirty ? "저장하지 않은 변경이 있어요" : " "}</p>
            <textarea
              aria-label="본문"
              placeholder="본문"
              maxLength={200000}
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            />
            <Todos key={saved.id} todos={draft.todos} onChange={(todos) => setDraft({ ...draft, todos })} />
            <div className="foot">
              <button className="link" onClick={() => create(saved.id)} disabled={busy}>+ 안에 새 글</button>
              <button className="danger" onClick={remove} disabled={busy}>지우기</button>
            </div>
          </>
        )}
      </main>

      {conflict && (
        <div className="overlay">
          <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="conflict-title">
            {conflict.kind === "changed" ? (
              <>
                <h2 id="conflict-title">그사이 다른 사람이 고쳤어요</h2>
                <p>새 글을 불러오면 내가 쓴 내용은 사라져요.</p>
                <button autoFocus onClick={() => show(conflict.latest)} disabled={busy}>새 글 불러오기</button>
                <button className="danger" onClick={() => save(conflict.latest.version)} disabled={busy}>내 글로 덮어쓰기</button>
              </>
            ) : (
              <>
                <h2 id="conflict-title">그사이 지워진 글이에요</h2>
                <p>내가 쓴 내용을 새 글로 저장할 수 있어요.</p>
                <button autoFocus className="primary" onClick={saveAsNew} disabled={busy}>새 글로 저장</button>
                <button onClick={() => { show(null); refresh(); }} disabled={busy}>버리기</button>
              </>
            )}
            {message && <p className="error">{message}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
