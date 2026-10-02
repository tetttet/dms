"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Database, LockKeyhole } from "lucide-react";

export default function AccessPage() {
  return <Suspense fallback={<main className="access-page" />}><AccessForm /></Suspense>;
}

function AccessForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/access", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password }) });
      const result = await response.json();
      if (!response.ok) return setError(result.error ?? "Login failed.");
      const next = search.get("next");
      let destination = "/";
      if (next?.startsWith("/")) {
        try {
          const url = new URL(next, window.location.origin);
          if (url.origin === window.location.origin && url.pathname !== "/access") {
            destination = url.pathname + url.search + url.hash;
          }
        } catch { /* Ignore malformed return paths. */ }
      }
      router.replace(destination);
      router.refresh();
    } catch {
      setError("Could not connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="access-page">
      <form className="access-card" onSubmit={submit}>
        <div className="brand-mark large"><Database size={24} /></div>
        <p className="eyebrow"><LockKeyhole size={13} /> Protected workspace</p>
        <h1>Sign in to DMS</h1>
        <p>Enter your username and password to open the database workspace.</p>
        <label>Username<input name="username" type="text" autoComplete="username" required value={username} onChange={(event) => setUsername(event.target.value)} autoFocus placeholder="Username" /></label>
        <label>Password<input name="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" /></label>
        {error && <div className="form-error">{error}</div>}
        <button className="button primary" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</button>
      </form>
    </main>
  );
}
