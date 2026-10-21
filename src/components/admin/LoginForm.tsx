"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { card, errorText, fieldLabel, input, primaryButton } from "./ui";

const MESSAGES: Record<string, string> = {
  invalid_credentials: "Mật khẩu không đúng.",
  rate_limited: "Đăng nhập sai quá nhiều lần, hãy thử lại sau ít phút.",
};
const UNAVAILABLE = "Không kết nối được máy chủ quản trị, hãy thử lại.";

export interface LoginFormProps {
  /** Called after a successful login; by default the page is refreshed (server re-render). */
  onSuccess?: () => void;
}

/** Owner login. The password only lives in this input's state and the request body. */
export default function LoginForm({ onSuccess }: LoginFormProps) {
  const router = useRouter();
  const id = useId();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!password || pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
        cache: "no-store",
      });
      if (res.ok) {
        setPassword("");
        if (onSuccess) onSuccess();
        else router.refresh();
        return;
      }
      const body = (await res.json().catch(() => null)) as { code?: unknown } | null;
      const code = typeof body?.code === "string" ? body.code : "";
      setError(MESSAGES[code] ?? UNAVAILABLE);
    } catch {
      setError(UNAVAILABLE);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-sm pt-10">
      <p className="font-mono text-label-mono-sm uppercase text-secondary">Quản trị · chỉ mình bạn</p>
      <h1 className="mb-4 mt-1 text-headline-lg-mobile text-on-surface">Đăng nhập</h1>
      <form onSubmit={submit} className={`${card} flex flex-col gap-4`} noValidate>
        <div>
          <label htmlFor={`${id}-password`} className={fieldLabel}>
            Mật khẩu
          </label>
          <input
            id={`${id}-password`}
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={input}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
          />
        </div>
        {error ? (
          <p id={`${id}-error`} role="alert" className={errorText}>
            {error}
          </p>
        ) : null}
        <button type="submit" className={primaryButton} disabled={pending || !password}>
          {pending ? "Đang đăng nhập…" : "Đăng nhập"}
        </button>
      </form>
    </div>
  );
}
