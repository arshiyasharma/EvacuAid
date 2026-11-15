"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="mt-8 space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ username, password }),
          });
          const j = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(j.error ?? "Sign-in failed");
          router.replace(next);
          router.refresh();
        } catch (err) {
          setError((err as Error).message);
          setPassword("");
        } finally {
          setBusy(false);
        }
      }}
    >
      <input
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Username"
        autoComplete="username"
        required
        className="w-full rounded-2xl border border-line-strong bg-white/[0.02] px-5 py-4 text-[18px] outline-none placeholder:text-faint focus:border-white/40"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        autoComplete="current-password"
        required
        className="w-full rounded-2xl border border-line-strong bg-white/[0.02] px-5 py-4 text-[18px] outline-none placeholder:text-faint focus:border-white/40"
      />
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-2xl bg-fg py-4 text-[18px] font-medium text-ink transition hover:bg-white disabled:opacity-50"
      >
        {busy ? "Checking…" : "Sign in"}
      </button>
      {error && <p className="text-[16px] text-help">{error}</p>}
    </form>
  );
}
