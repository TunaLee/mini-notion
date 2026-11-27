"use client";

import { useRef } from "react";
import type { Todo } from "@/lib/types";

// crypto.randomUUID 는 http 로 접속한 다른 기기(같은 와이파이)에서는 없어서 쓰지 않는다.
const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export default function Todos({ todos, onChange }: { todos: Todo[]; onChange: (todos: Todo[]) => void }) {
  const focusId = useRef<string | null>(null);

  const add = () => {
    const todo = { id: newId(), text: "", done: false };
    focusId.current = todo.id;
    onChange([...todos, todo]);
  };
  const change = (id: string, patch: Partial<Todo>) =>
    onChange(todos.map((todo) => (todo.id === id ? { ...todo, ...patch } : todo)));

  return (
    <section className="todos">
      <h2>할 일</h2>
      <ul>
        {todos.map((todo) => (
          <li key={todo.id} className={todo.done ? "done" : undefined}>
            <input type="checkbox" aria-label="완료" checked={todo.done} onChange={(e) => change(todo.id, { done: e.target.checked })} />
            <input
              type="text"
              aria-label="할 일 내용"
              maxLength={1000}
              value={todo.text}
              ref={(node) => {
                if (node && focusId.current === todo.id) {
                  focusId.current = null;
                  node.focus();
                }
              }}
              onChange={(e) => change(todo.id, { text: e.target.value })}
              onKeyDown={(e) => {
                // 한글을 조합하는 중에 누른 Enter 는 무시한다.
                if (e.key === "Enter" && !e.nativeEvent.isComposing) add();
              }}
            />
            <button aria-label="할 일 삭제" onClick={() => onChange(todos.filter((item) => item.id !== todo.id))}>✕</button>
          </li>
        ))}
      </ul>
      <button className="link" onClick={add}>+ 할 일 추가</button>
    </section>
  );
}
