"use client";

import { useId, useRef, useState } from "react";
import { endOfDayVn, todayVn } from "./format";
import { cardTitle, errorText, fieldLabel, hint, input, pill, primaryButton, smallGhostButton } from "./ui";

const NAME_MAX = 80;
const TWISTFIT_MAX_CEILING = 1_000_000;

const API_MESSAGES: Record<string, string> = {
  invalid_request: "Dữ liệu không hợp lệ, hãy kiểm tra lại các ô.",
  rate_limited: "Quá nhiều yêu cầu, hãy thử lại sau.",
};
const UNAVAILABLE = "Không tạo được link, hãy thử lại.";

type CopyState = "idle" | "copied" | "selected";

export interface CreateLinkFormProps {
  /** Public site origin (server env SITE_URL); empty -> warning + current origin. */
  siteUrl: string;
  onCreated: () => void;
  onUnauthorized: () => void;
}

/**
 * "Tạo link mới". The full invite URL is shown once, only in this component's state: it is
 * replaced by the next link, gone on reload, never stored nor logged.
 */
export default function CreateLinkForm({ siteUrl, onCreated, onUnauthorized }: CreateLinkFormProps) {
  const id = useId();
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cap, setCap] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ name: string; url: string } | null>(null);
  const [copy, setCopy] = useState<CopyState>("idle");
  const urlRef = useRef<HTMLElement>(null);

  const origin = siteUrl.trim().replace(/\/+$/, "");

  function validate(): { body: Record<string, unknown> } | { error: string } {
    const trimmed = name.trim();
    if (!trimmed) return { error: "Hãy nhập tên link." };
    if (trimmed.length > NAME_MAX) return { error: `Tên link tối đa ${NAME_MAX} ký tự.` };
    const body: Record<string, unknown> = { name: trimmed };
    if (expiry) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry)) return { error: "Ngày hết hạn không hợp lệ." };
      if (expiry < todayVn()) return { error: "Ngày hết hạn đã qua, hãy chọn hôm nay hoặc sau đó." };
      body.expires_at = endOfDayVn(expiry);
    }
    if (cap.trim()) {
      const n = Number(cap.trim());
      if (!/^\d+$/.test(cap.trim()) || !Number.isInteger(n) || n < 1 || n > TWISTFIT_MAX_CEILING) {
        return { error: "Giới hạn Twistfit phải là số nguyên từ 1 trở lên (để trống = không giới hạn)." };
      }
      body.twistfit_max = n;
    }
    return { body };
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    const checked = validate();
    if ("error" in checked) {
      setError(checked.error);
      return;
    }
    setPending(true);
    setError(null);
    setCreated(null);
    setCopy("idle");
    try {
      const res = await fetch("/api/admin/links", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(checked.body),
        cache: "no-store",
      });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!res.ok || typeof body?.token !== "string") {
        const code = typeof body?.code === "string" ? body.code : "";
        setError(API_MESSAGES[code] ?? UNAVAILABLE);
        return;
      }
      const base = origin || window.location.origin;
      setCreated({ name: String(body.name ?? checked.body.name), url: `${base}/i/${body.token}` });
      setName("");
      setExpiry("");
      setCap("");
      onCreated();
    } catch {
      setError(UNAVAILABLE);
    } finally {
      setPending(false);
    }
  }

  function selectUrl() {
    const node = urlRef.current;
    const selection = window.getSelection();
    if (!node || !selection) return;
    const range = document.createRange();
    range.selectNodeContents(node);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  async function copyUrl() {
    if (!created) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("no clipboard");
      await navigator.clipboard.writeText(created.url);
      setCopy("copied");
    } catch {
      selectUrl();
      setCopy("selected");
    }
  }

  return (
    <div>
      <h2 className={cardTitle}>Tạo link mới</h2>
      {!origin ? (
        <p role="note" className="mb-3 rounded-lg border border-error/60 bg-error-container/40 px-3 py-2 text-body-md text-on-error-container">
          SITE_URL chưa được đặt, hãy thay tên miền thủ công trong link được tạo.
        </p>
      ) : null}
      <form onSubmit={submit} noValidate className="grid grid-cols-1 items-start gap-3 md:grid-cols-[2fr_1fr_1fr_auto]">
        <div>
          <label htmlFor={`${id}-name`} className={fieldLabel}>
            Tên link (chỉ bạn nhìn thấy)
          </label>
          <input
            id={`${id}-name`}
            required
            maxLength={NAME_MAX}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={input}
            placeholder="vd. Công ty X – vòng 1"
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor={`${id}-expiry`} className={fieldLabel}>
            Hết hạn (tuỳ chọn)
          </label>
          <input
            id={`${id}-expiry`}
            type="date"
            min={todayVn()}
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            className={input}
            aria-describedby={`${id}-expiry-hint`}
          />
          <p id={`${id}-expiry-hint`} className={`mt-1 ${hint}`}>
            Hết hạn vào cuối ngày này, giờ Việt Nam (UTC+7)
          </p>
        </div>
        <div>
          <label htmlFor={`${id}-cap`} className={fieldLabel}>
            Tối đa lượt Twistfit (tuỳ chọn)
          </label>
          <input
            id={`${id}-cap`}
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={cap}
            onChange={(e) => setCap(e.target.value)}
            className={input}
            placeholder="trống = không giới hạn"
          />
        </div>
        <div className="md:pt-5">
          <button type="submit" className={`${primaryButton} w-full md:w-auto`} disabled={pending}>
            {pending ? "Đang tạo…" : "Tạo link"}
          </button>
        </div>
      </form>
      {error ? (
        <p role="alert" className={`mt-3 ${errorText}`}>
          {error}
        </p>
      ) : null}
      {created ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-primary-container bg-primary-container/10 px-3 py-2.5">
          <span className={`${pill} border-secondary/40 bg-secondary/10 text-secondary`}>
            <span aria-hidden="true" className="inline-block size-2 shrink-0 rounded-full bg-current" />
            <span>Đã tạo: {created.name}</span>
          </span>
          <code ref={urlRef} className="w-full min-w-0 break-all sm:w-auto sm:flex-1 font-mono text-code-inline text-primary">
            {created.url}
          </code>
          <button type="button" className={smallGhostButton} onClick={() => void copyUrl()}>
            Sao chép
          </button>
          <p aria-live="polite" className={`w-full ${hint}`}>
            {copy === "copied" ? "Đã sao chép" : null}
            {copy === "selected" ? "Không sao chép tự động được; đường link đã được bôi đen, hãy nhấn Ctrl+C." : null}
          </p>
        </div>
      ) : null}
      <p className={`mt-3 ${hint}`}>
        Link chỉ hiện đầy đủ một lần lúc vừa tạo; sau đó bạn chỉ thấy tên và trạng thái (và vẫn thu hồi được).
      </p>
    </div>
  );
}
