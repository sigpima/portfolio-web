import type { ChatErrorCode } from "@/lib/chat/types";
import type { FlowLabels } from "./chat-flow";

/** A translator scoped to the `kb` messages namespace (next-intl's `t` fits). */
export type KbTranslate = (key: string, values?: Record<string, number>) => string;

/** Node labels of the chat diagram, from `kb.nodes.*`, `kb.extraCall` and `kb.rowCount`. */
export function chatFlowLabels(t: KbTranslate): FlowLabels {
  return {
    question: { label: t("nodes.question.label"), sublabel: t("nodes.question.sublabel") },
    model: { label: t("nodes.model.label"), sublabel: t("nodes.model.sublabel") },
    tool: { label: t("nodes.tool.label"), sublabel: t("nodes.tool.sublabel") },
    database: { label: t("nodes.database.label"), sublabel: t("nodes.database.sublabel") },
    answer: { label: t("nodes.answer.label"), sublabel: t("nodes.answer.sublabel") },
    extraCall: (n) => t("extraCall", { n }),
    rowCount: (count) => t("rowCount", { count }),
  };
}

export type ChatEventErrorKey = "sessionFull" | "model" | "generic";

/** `kb.errors.*` key for an `error` event: we show our own text, never the upstream message. */
export function chatErrorKey(code: ChatErrorCode): ChatEventErrorKey {
  switch (code) {
    case "session_full":
      return "sessionFull";
    case "model":
      return "model";
    default:
      return "generic";
  }
}
