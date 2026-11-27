"use client";

import type { PageSummary } from "@/lib/types";

export const label = (title: string) => title.trim() || "제목 없음";

export function childrenByParent(pages: PageSummary[]) {
  const map = new Map<number | null, PageSummary[]>();
  for (const page of pages) {
    const siblings = map.get(page.parentId);
    if (siblings) siblings.push(page);
    else map.set(page.parentId, [page]);
  }
  return map;
}

export function countInside(pages: PageSummary[], id: number): number {
  const map = childrenByParent(pages);
  const count = (parent: number): number =>
    (map.get(parent) ?? []).reduce((sum, child) => sum + 1 + count(child.id), 0);
  return count(id);
}

type Props = {
  pages: PageSummary[];
  selectedId: number | null;
  closed: Set<number>;
  onToggle: (id: number) => void;
  onOpen: (id: number) => void;
};

export default function Tree(props: Props) {
  const map = childrenByParent(props.pages);

  const render = (parent: number | null) => {
    const items = map.get(parent);
    if (!items) return null;
    return (
      <ul>
        {items.map((page) => {
          const hasChildren = map.has(page.id);
          const open = !props.closed.has(page.id);
          return (
            <li key={page.id}>
              <div className={page.id === props.selectedId ? "row selected" : "row"}>
                {hasChildren ? (
                  <button className="toggle" aria-label={open ? "접기" : "펼치기"} aria-expanded={open} onClick={() => props.onToggle(page.id)}>
                    {open ? "▾" : "▸"}
                  </button>
                ) : (
                  <span className="toggle" />
                )}
                <button className="title" onClick={() => props.onOpen(page.id)}>{label(page.title)}</button>
              </div>
              {hasChildren && open && render(page.id)}
            </li>
          );
        })}
      </ul>
    );
  };

  return render(null);
}
