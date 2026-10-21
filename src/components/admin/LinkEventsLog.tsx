"use client";

import { useCallback, useEffect, useState } from "react";
import { describeDetail, formatVnTime } from "./format";
import type { AdminEvent } from "./types";
import { cardTitle, errorText, pill, smallGhostButton } from "./ui";

const PAGE_SIZE = 50;

const FEATURE_LABELS: Record<string, string> = {
  open: "Mở link",
  chat: "Bot",
  twistfit: "Twistfit",
  gia_pha: "Gia phả",
};

const OUTCOME_STYLES: Record<string, { label: string; className: string; shape: string }> = {
  success: { label: "thành công", className: "text-secondary border-secondary/40 bg-secondary/10", shape: "size-2 rounded-full bg-current" },
  error: { label: "lỗi", className: "text-error border-error/40 bg-error/10", shape: "size-2 rounded-[1px] bg-current" },
  blocked: { label: "bị chặn", className: "text-on-surface-variant border-outline-variant", shape: "size-2 rounded-full border border-current" },
};

function Outcome({ outcome }: { outcome: string }) {
  const style = OUTCOME_STYLES[outcome];
  if (!style) return <span className="font-mono text-code-inline">{outcome}</span>;
  return (
    <span className={`${pill} ${style.className}`}>
      <span aria-hidden="true" className={`inline-block shrink-0 ${style.shape}`} />
      <span>{style.label}</span>
    </span>
  );
}

function Detail({ detail }: { detail: AdminEvent["detail"] }) {
  const view = describeDetail(detail);
  if (view.kind === "code") return <code className="font-mono text-code-inline text-on-surface-variant">{view.text}</code>;
  if (view.kind === "none") return <span className="text-outline">{view.text}</span>;
  return <span className="break-words text-on-surface">{view.text}</span>;
}

const th = "border-b border-outline-variant px-2.5 py-2 text-left font-mono text-label-mono-xs uppercase text-outline font-medium";
const td = "border-b border-outline-variant/50 px-2.5 py-2 align-middle";

export interface LinkEventsLogProps {
  link: { id: number; name: string };
  onUnauthorized: () => void;
}

/** Usage log of one link, newest first, paged with `before=<last id>`. Mount with `key={id}`. */
export default function LinkEventsLog({ link, onUnauthorized }: LinkEventsLogProps) {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(
    async (before: number | null) => {
      setLoading(true);
      setError(false);
      const query = `limit=${PAGE_SIZE}${before === null ? "" : `&before=${before}`}`;
      try {
        const res = await fetch(`/api/admin/links/${link.id}/events?${query}`, { cache: "no-store" });
        if (res.status === 401) {
          onUnauthorized();
          return;
        }
        if (!res.ok) throw new Error("events");
        const page: unknown = await res.json();
        if (!Array.isArray(page)) throw new Error("events");
        const rows = page as AdminEvent[];
        setEvents((prev) => (before === null ? rows : [...prev, ...rows]));
        setHasMore(rows.length === PAGE_SIZE);
        setLoaded(true);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [link.id, onUnauthorized],
  );

  useEffect(() => {
    // Fetch on mount; state updates happen after the await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(null);
  }, [load]);

  const lastId = events.length ? events[events.length - 1].id : null;

  return (
    <div>
      <h2 className={cardTitle}>
        Nhật ký: <span className="normal-case text-on-surface">{link.name}</span>
      </h2>
      {loaded && events.length === 0 ? (
        <p className="text-body-md text-on-surface-variant">Link này chưa có hoạt động nào.</p>
      ) : null}
      {events.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-body-md">
            <caption className="sr-only">Nhật ký sử dụng, mới nhất trước</caption>
            <thead>
              <tr>
                <th scope="col" className={`${th} w-32`}>Lúc</th>
                <th scope="col" className={`${th} w-32`}>Tính năng</th>
                <th scope="col" className={`${th} w-32`}>Kết quả</th>
                <th scope="col" className={th}>Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td className={`${td} whitespace-nowrap font-mono text-code-inline text-on-surface-variant`}>{formatVnTime(event.ts)}</td>
                  <td className={`${td} font-mono text-code-inline`}>{FEATURE_LABELS[event.feature] ?? event.feature}</td>
                  <td className={td}>
                    <Outcome outcome={event.outcome} />
                  </td>
                  <td className={td}>
                    <Detail detail={event.detail} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className={`mt-3 ${errorText}`}>
          Không tải được nhật ký, hãy thử lại.
        </p>
      ) : null}
      {loading && !loaded ? <p className="text-body-md text-outline">Đang tải nhật ký…</p> : null}
      {error && lastId === null ? (
        <button type="button" className={`mt-3 ${smallGhostButton}`} disabled={loading} onClick={() => void load(null)}>
          Thử lại
        </button>
      ) : null}
      {(hasMore || error) && lastId !== null ? (
        <button type="button" className={`mt-3 ${smallGhostButton}`} disabled={loading} onClick={() => void load(lastId)}>
          {loading ? "Đang tải…" : "Tải thêm"}
        </button>
      ) : null}
    </div>
  );
}
