"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Markdown } from "@/components/Markdown";
import { Modal } from "@/components/Modal";
import type { Citation } from "@/lib/citations";
import { findPolicyTarget, loadPolicies, type PolicyDoc } from "@/lib/policies";

type State =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; doc: PolicyDoc; sectionIndex: number | null };

export interface PolicyDocDialogProps {
  citation: Citation;
  closeLabel: string;
  onClose: () => void;
  /** Set when the document was opened from a list: shows a back button that closes this and runs it. */
  onBack?: () => void;
}

/**
 * The policy document a citation points at, in a modal: the whole document with the cited section
 * highlighted and scrolled into view. The documents are Vietnamese whatever the site language.
 */
export function PolicyDocDialog({ citation, closeLabel, onClose, onBack }: PolicyDocDialogProps) {
  const t = useTranslations("kb.policy");
  const [state, setState] = useState<State>({ status: "loading" });
  const citedRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let cancelled = false;
    loadPolicies()
      .then((index) => {
        if (cancelled) return;
        const target = findPolicyTarget(index, citation);
        setState(target ? { status: "ready", ...target } : { status: "missing" });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "missing" });
      });
    return () => {
      cancelled = true;
    };
  }, [citation]);

  useEffect(() => {
    // jsdom has no scrollIntoView.
    if (state.status === "ready") citedRef.current?.scrollIntoView?.({ block: "center" });
  }, [state]);

  const doc = state.status === "ready" ? state.doc : null;
  return (
    <Modal
      title={doc?.title ?? citation.slug}
      subtitle={doc ? `${t(`docType.${doc.docType}`)} · ${doc.slug}` : undefined}
      closeLabel={closeLabel}
      onClose={onClose}
      onBack={
        onBack
          ? () => {
              onClose();
              onBack();
            }
          : undefined
      }
      backLabel={onBack ? t("back") : undefined}
      size="lg"
    >
      {state.status === "loading" ? <p className="text-body-md text-on-surface-variant">{t("loading")}</p> : null}
      {state.status === "missing" ? <p className="text-body-md text-on-surface-variant">{t("notFound")}</p> : null}
      {doc ? (
        <div className="flex flex-col gap-4">
          <p className="rounded-lg border border-outline-variant px-3 py-2 text-body-md text-on-surface-variant">
            {t("synthetic")}
          </p>
          <div lang="vi" className="flex flex-col gap-4 text-body-md text-on-surface">
            {doc.intro ? <Markdown>{doc.intro}</Markdown> : null}
            {doc.sections.map((section, i) => {
              const cited = state.status === "ready" && state.sectionIndex === i;
              return (
                <section
                  key={`${i}-${section.heading}`}
                  ref={cited ? citedRef : undefined}
                  data-role={cited ? "cited-section" : undefined}
                  className={`border-l-2 pl-3 ${section.level === 3 ? "ml-4" : ""} ${
                    cited ? "border-secondary bg-secondary/10" : "border-transparent"
                  }`}
                >
                  <h4 className={`mb-1 font-semibold text-on-surface ${section.level === 3 ? "text-body-md" : "text-headline-md"}`}>
                    {section.heading}
                  </h4>
                  <Markdown>{section.body}</Markdown>
                </section>
              );
            })}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
