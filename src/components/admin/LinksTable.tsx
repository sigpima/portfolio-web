"use client";

import { useEffect, useState } from "react";
import { formatVnTime } from "./format";
import type { AdminLink, LinkStatus } from "./types";
import { dangerButton, dangerConfirmButton, pill } from "./ui";

/** How long the "Xác nhận thu hồi" button waits for the second click. */
const CONFIRM_MS = 5000;

type Shape = "dot" | "ring" | "square" | "square-outline";

export interface StatusStyle {
  label: string;
  /** Colour token of the label text (checked for contrast in the test). */
  token: string;
  /** Opacity of the pill fill (same token as the text). */
  bgAlpha: number;
  className: string;
  shape: Shape;
}

/** Status text + a shape cue + colour (never colour alone). */
export const STATUS_STYLES: Record<LinkStatus, StatusStyle> = {
  active: {
    label: "Đang hoạt động",
    token: "secondary",
    bgAlpha: 0.1,
    className: "text-secondary border-secondary/40 bg-secondary/10",
    shape: "dot",
  },
  unused: {
    label: "Chưa ai mở",
    token: "on-surface-variant",
    bgAlpha: 0,
    className: "text-on-surface-variant border-outline-variant",
    shape: "ring",
  },
  revoked: {
    label: "Đã thu hồi",
    token: "error",
    bgAlpha: 0.1,
    className: "text-error border-error/40 bg-error/10",
    shape: "square",
  },
  expired: {
    label: "Hết hạn",
    token: "outline",
    bgAlpha: 0,
    className: "text-outline border-outline/50",
    shape: "square-outline",
  },
};

const SHAPE_CLASS: Record<Shape, string> = {
  dot: "size-2 rounded-full bg-current",
  ring: "size-2 rounded-full border border-current",
  square: "size-2 rounded-[1px] bg-current",
  "square-outline": "size-2 rounded-[1px] border border-current",
};

export function StatusPill({ status }: { status: LinkStatus }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.expired;
  return (
    <span data-status={status} className={`${pill} ${style.className}`}>
      <span data-shape={style.shape} aria-hidden="true" className={`inline-block shrink-0 ${SHAPE_CLASS[style.shape]}`} />
      <span>{style.label}</span>
    </span>
  );
}

function RevokeButton({ link, onRevoke }: { link: AdminLink; onRevoke: (id: number) => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [confirming]);

  async function click(event: React.MouseEvent) {
    event.stopPropagation();
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setPending(true);
    try {
      await onRevoke(link.id);
    } finally {
      setPending(false);
      setConfirming(false);
    }
  }

  return (
    <button
      type="button"
      onClick={click}
      disabled={pending}
      aria-label={confirming ? `Xác nhận thu hồi ${link.name}` : `Thu hồi ${link.name}`}
      className={confirming ? dangerConfirmButton : dangerButton}
    >
      {pending ? "Đang thu hồi…" : confirming ? "Xác nhận thu hồi" : "Thu hồi"}
    </button>
  );
}

const th = "border-b border-outline-variant px-2.5 py-2 text-left font-mono text-label-mono-xs uppercase text-outline font-medium";
const td = "border-b border-outline-variant/50 px-2.5 py-2.5 align-middle";
const num = `${td} text-center font-mono text-code-inline`;

export interface LinksTableProps {
  links: AdminLink[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onRevoke: (id: number) => Promise<void>;
}

/** The links table; a row is selected by clicking it or with the name button (keyboard). */
export default function LinksTable({ links, selectedId, onSelect, onRevoke }: LinksTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-body-md">
        <caption className="sr-only">Các link đã tạo; chọn một dòng để xem nhật ký</caption>
        <thead>
          <tr>
            <th scope="col" className={th}>Tên</th>
            <th scope="col" className={th}>Trạng thái</th>
            <th scope="col" className={th}>Tạo lúc</th>
            <th scope="col" className={th}>Dùng gần nhất</th>
            <th scope="col" className={`${th} text-center`}>Bot</th>
            <th scope="col" className={`${th} text-center`}>Twistfit</th>
            <th scope="col" className={`${th} text-center`}>Gia phả</th>
            <th scope="col" className={th}>
              <span className="sr-only">Thao tác</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {links.map((link) => {
            const selected = link.id === selectedId;
            const canRevoke = link.status === "active" || link.status === "unused";
            return (
              <tr
                key={link.id}
                onClick={() => onSelect(link.id)}
                className={`cursor-pointer ${selected ? "bg-primary-container/10" : "hover:bg-surface-container"}`}
              >
                <td className={td}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect(link.id);
                    }}
                    className="max-w-[16rem] break-words rounded text-left font-semibold text-on-surface"
                  >
                    {link.name}
                  </button>
                  {link.expires_at ? (
                    <span className="block text-label-mono-sm text-outline">hết hạn {formatVnTime(link.expires_at)}</span>
                  ) : null}
                </td>
                <td className={td}>
                  <StatusPill status={link.status} />
                </td>
                <td className={`${td} font-mono text-code-inline text-on-surface-variant`}>{formatVnTime(link.created_at)}</td>
                <td className={`${td} font-mono text-code-inline text-on-surface-variant`}>{formatVnTime(link.last_used_at)}</td>
                <td className={num}>{link.counts.chat}</td>
                <td className={num}>
                  {link.twistfit_max ? `${link.counts.twistfit}/${link.twistfit_max}` : link.counts.twistfit}
                </td>
                <td className={num}>{link.counts.gia_pha}</td>
                <td className={`${td} text-right`}>
                  {canRevoke ? <RevokeButton link={link} onRevoke={onRevoke} /> : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
