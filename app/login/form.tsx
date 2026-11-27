"use client";

import { useState } from "react";

export default function LoginForm() {
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/auth/${signup ? "signup" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (response.ok) {
        window.location.assign("/");
        return;
      }
      setError((await response.json()).error);
    } catch {
      setError("서버에 연결하지 못했어요");
    }
    setBusy(false);
  }

  const action = signup ? "가입하기" : "로그인하기";

  return (
    <main className="login">
      <h1>미니 노션</h1>
      <form onSubmit={submit}>
        <label>
          이메일
          <input type="email" name="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          비밀번호
          <input
            type="password"
            name="password"
            autoComplete={signup ? "new-password" : "current-password"}
            minLength={signup ? 8 : undefined}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {signup && <p className="hint">8자 이상. 다른 곳에서 쓰는 비밀번호는 쓰지 마세요.</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" type="submit" disabled={busy}>{action}</button>
      </form>
      <button
        className="link"
        type="button"
        onClick={() => {
          setSignup(!signup);
          setError("");
        }}
      >
        {signup ? "이미 계정이 있어요 → 로그인하기" : "처음이에요 → 가입하기"}
      </button>
    </main>
  );
}
