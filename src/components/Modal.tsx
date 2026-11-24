"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface ModalProps {
  title: string;
  /** Short line above the title (the step a JSON belongs to, the kind of a document). */
  subtitle?: string;
  closeLabel: string;
  onClose: () => void;
  /** `lg` for reading text, `md` (default) for short data. */
  size?: "md" | "lg";
  children: ReactNode;
}

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * A modal over a dimmed, blurred page. Closes with Escape, the close button or a click on the
 * backdrop; focus stays inside while open and returns to whatever opened it.
 */
export function Modal({ title, subtitle, closeLabel, onClose, size = "md", children }: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      opener?.focus();
    };
  }, []);

  // Keys are handled on the document, so Escape and Tab still work after a click on a
  // non-focusable part of the panel has moved focus to the page.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const inside = active instanceof HTMLElement && panelRef.current?.contains(active);
      if (!inside) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return createPortal(
    <div
      data-role="flow-dialog-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-surface-container-lowest/70 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`flex max-h-[85vh] w-full ${size === "lg" ? "max-w-3xl" : "max-w-2xl"} flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container shadow-2xl`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-outline-variant px-4 py-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            {subtitle ? (
              <p className="font-mono text-label-mono-sm tracking-wider text-outline uppercase">{subtitle}</p>
            ) : null}
            <h3 id={titleId} className="text-headline-md text-on-surface">
              {title}
            </h3>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-outline-variant px-3 py-1.5 text-body-md text-on-surface hover:border-secondary hover:text-secondary"
          >
            {closeLabel}
          </button>
        </div>
        <div className="overflow-auto bg-surface-container-lowest p-4">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
