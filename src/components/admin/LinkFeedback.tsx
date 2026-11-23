"use client";

import { useCallback, useEffect, useState } from "react";
import { formatVnTime } from "./format";
import type { AdminFeedback } from "./types";
import { cardTitle, errorText, smallGhostButton } from "./ui";

const PAGE_SIZE = 50;

export interface LinkFeedbackProps {
  link: { id: number; name: string };
  onUnauthorized: () => void;
}

/**
 * Feedback the people holding one link sent, verbatim, newest first, paged with `before=<last id>`.
 * The text is shown as plain text (never as HTML). Mount with `key={id}`.
 */
export default function LinkFeedback({ link, onUnauthorized }: LinkFeedbackProps) {
  const [items, setItems] = useState<AdminFeedback[]>([]);
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
        const res = await fetch(`/api/admin/links/${link.id}/feedback?${query}`, { cache: "no-store" });
        if (res.status === 401) {
          onUnauthorized();
          return;
        }
        if (!res.ok) throw new Error("feedback");
        const page: unknown = await res.json();
        if (!Array.isArray(page)) throw new Error("feedback");
        const rows = page as AdminFeedback[];
        setItems((prev) => (before === null ? rows : [...prev, ...rows]));
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

  const lastId = items.length ? items[items.length - 1].id : null;

  return (
    <div>
      <h2 className={cardTitle}>
        Góp ý: <span className="normal-case text-on-surface">{link.name}</span>
      </h2>
      {loaded && items.length === 0 ? (
        <p className="text-body-md text-on-surface-variant">Link này chưa có góp ý nào.</p>
      ) : null}
      {items.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border border-outline-variant bg-surface px-3 py-2.5">
              <p className="font-mono text-code-inline text-on-surface-variant">{formatVnTime(item.ts)}</p>
              <p className="mt-1 break-words whitespace-pre-wrap text-body-md text-on-surface">{item.message}</p>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <p role="alert" className={`mt-3 ${errorText}`}>
          Không tải được góp ý, hãy thử lại.
        </p>
      ) : null}
      {loading && !loaded ? <p className="text-body-md text-outline">Đang tải góp ý…</p> : null}
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
