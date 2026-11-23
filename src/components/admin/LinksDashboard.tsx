"use client";

import { useCallback, useEffect, useState } from "react";
import CreateLinkForm from "./CreateLinkForm";
import LinkEventsLog from "./LinkEventsLog";
import LinkFeedback from "./LinkFeedback";
import LinksTable from "./LinksTable";
import LoginForm from "./LoginForm";
import type { AdminLink } from "./types";
import { card, cardTitle, errorText, ghostButton, smallGhostButton } from "./ui";

export interface LinksDashboardProps {
  /** Public site origin from the server env SITE_URL ("" when unset). */
  siteUrl: string;
}

/** The admin dashboard: create link, links table, per-link log. Any 401 shows the login form. */
export default function LinksDashboard({ siteUrl }: LinksDashboardProps) {
  const [authed, setAuthed] = useState(true);
  const [links, setLinks] = useState<AdminLink[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const unauthorized = useCallback(() => {
    setAuthed(false);
    setLinks(null);
    setSelectedId(null);
  }, []);

  const loadLinks = useCallback(async () => {
    setLoadError(false);
    try {
      const res = await fetch("/api/admin/links", { cache: "no-store" });
      if (res.status === 401) {
        unauthorized();
        return;
      }
      if (!res.ok) throw new Error("links");
      const body: unknown = await res.json();
      if (!Array.isArray(body)) throw new Error("links");
      setLinks(body as AdminLink[]);
    } catch {
      setLoadError(true);
    }
  }, [unauthorized]);

  useEffect(() => {
    if (!authed) return;
    // Fetch on mount and after logging back in; state updates happen after the await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadLinks();
  }, [authed, loadLinks]);

  const revoke = useCallback(
    async (id: number) => {
      setActionError(null);
      try {
        const res = await fetch(`/api/admin/links/${id}/revoke`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
          cache: "no-store",
        });
        if (res.status === 401) {
          unauthorized();
          return;
        }
        if (!res.ok) throw new Error("revoke");
      } catch {
        setActionError("Không thu hồi được link, hãy thử lại.");
      }
      await loadLinks();
    },
    [loadLinks, unauthorized],
  );

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/admin/logout", {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
    } catch {
      // the cookie may remain; the API session still expires on its own
    } finally {
      setLoggingOut(false);
      unauthorized();
    }
  }

  if (!authed) return <LoginForm onSuccess={() => setAuthed(true)} />;

  const selected = links?.find((l) => l.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-label-mono-sm uppercase text-secondary">Quản trị · chỉ mình bạn</p>
          <h1 className="mt-0.5 text-headline-lg-mobile text-on-surface">Link mời</h1>
          <p className="text-body-md text-outline">
            Tạo link cho từng người, xem họ đã dùng tính năng nào và đọc góp ý họ gửi. Câu hỏi của họ cho bot không được lưu.
          </p>
        </div>
        <button type="button" className={ghostButton} onClick={() => void logout()} disabled={loggingOut}>
          Đăng xuất
        </button>
      </div>

      <section className={card}>
        <CreateLinkForm siteUrl={siteUrl} onCreated={() => void loadLinks()} onUnauthorized={unauthorized} />
      </section>

      <section className={card} aria-labelledby="admin-links-title">
        <h2 id="admin-links-title" className={cardTitle}>
          Các link đã tạo
        </h2>
        {actionError ? (
          <p role="alert" className={`mb-3 ${errorText}`}>
            {actionError}
          </p>
        ) : null}
        {loadError ? (
          <div className="flex flex-wrap items-center gap-3">
            <p role="alert" className={errorText}>
              Không tải được danh sách link.
            </p>
            <button type="button" className={smallGhostButton} onClick={() => void loadLinks()}>
              Thử lại
            </button>
          </div>
        ) : links === null ? (
          <p className="text-body-md text-outline">Đang tải…</p>
        ) : links.length === 0 ? (
          <p className="text-body-md text-on-surface-variant">Chưa có link nào. Hãy tạo link đầu tiên ở trên.</p>
        ) : (
          <LinksTable links={links} selectedId={selectedId} onSelect={setSelectedId} onRevoke={revoke} />
        )}
      </section>

      <section className={card}>
        {selected ? (
          <LinkEventsLog key={selected.id} link={selected} onUnauthorized={unauthorized} />
        ) : (
          <>
            <h2 className={cardTitle}>Nhật ký</h2>
            <p className="text-body-md text-on-surface-variant">Bấm một dòng ở bảng để xem nhật ký của link đó.</p>
          </>
        )}
        <p className="mt-4 text-label-mono-sm text-outline">
          Không ghi: nội dung câu hỏi, câu trả lời của bot, địa chỉ IP, chuỗi trình duyệt. Chỉ ghi link nào, tính năng
          nào, lúc nào, kết quả, và danh mục đồ đã chọn ở Twistfit. Ngoại lệ: góp ý người có link gửi qua ô Liên hệ được
          lưu nguyên văn ở khung Góp ý bên dưới.
        </p>
        <p className="mt-2 text-label-mono-sm text-outline">
          Lưu ý: một số công cụ xem trước link hoặc quét email có thể được tính là một lần &apos;Mở link&apos;.
        </p>
      </section>

      {selected ? (
        <section className={card}>
          <LinkFeedback key={selected.id} link={selected} onUnauthorized={unauthorized} />
        </section>
      ) : null}
    </div>
  );
}
