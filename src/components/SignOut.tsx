"use client";

import { useRouter } from "next/navigation";

export function SignOut() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.refresh();
        router.push("/console");
      }}
      className="text-[15.5px] text-muted transition hover:text-fg"
    >
      Sign out
    </button>
  );
}
