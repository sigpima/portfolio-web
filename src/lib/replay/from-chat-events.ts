import { createTranslator, type AbstractIntlMessages } from "next-intl";
import type { ReplaySample } from "@/content/replays/types";
import type { Locale, Localized } from "@/content/types";
import type { ChatEvent } from "@/lib/chat/types";
import { initialChatFlow, reduceChatFlow, type FlowEvent, type FlowLabels } from "@/lib/flow/chat-flow";
import { chatErrorKey, chatFlowLabels, type KbTranslate } from "@/lib/flow/chat-flow-labels";
import type { FlowNode, FlowState } from "@/lib/flow/model";
import viMessages from "../../../messages/vi.json";
import enMessages from "../../../messages/en.json";

/** A chat event and when it arrived, in ms after the question was sent. */
export interface TimedChatEvent {
  atMs: number;
  event: ChatEvent;
}

const LOCALES: Locale[] = ["vi", "en"];

function kbTranslator(locale: Locale): KbTranslate {
  const messages: AbstractIntlMessages = locale === "vi" ? viMessages : enMessages;
  const t = createTranslator({ locale, messages, namespace: "kb" });
  // Untyped messages: next-intl cannot infer which keys take values, so widen it here.
  return t as unknown as KbTranslate;
}

const T = { vi: kbTranslator("vi"), en: kbTranslator("en") };
const LABELS: Record<Locale, FlowLabels> = {
  vi: chatFlowLabels(T.vi),
  en: chatFlowLabels(T.en),
};

/** The event as the live demo folds it in: an `error` carries our own localized text. */
function localizedEvent(event: ChatEvent, locale: Locale): FlowEvent {
  if (event.type !== "error") return event;
  return { ...event, message: T[locale](`errors.${chatErrorKey(event.code)}`) };
}

function nodesOf(state: FlowState): { node: FlowNode; rowId: string; rowTitle?: string }[] {
  return state.rows.flatMap((row) => row.nodes.map((node) => ({ node, rowId: row.id, rowTitle: row.title })));
}

/**
 * Turns a recorded chat run into a replay sample. The diagram is rebuilt with the
 * same reducer as the live demo (once per language), and one step is emitted for each
 * node whose status or detail changed, at the time the event really arrived.
 * Pure: no clock, no I/O; the result is never a placeholder.
 */
export function buildReplaySample(
  events: TimedChatEvent[],
  options: {
    id: string;
    title: Localized;
    question: Localized;
    /** Language of the question and answer when it does not follow the UI (recorded runs). */
    lang?: Locale;
  },
): ReplaySample {
  let flows: Record<Locale, FlowState> = {
    vi: initialChatFlow(LABELS.vi),
    en: initialChatFlow(LABELS.en),
  };
  const steps: ReplaySample["steps"] = [];
  let clock = 0;

  const fold = (atMs: number, event: (locale: Locale) => FlowEvent) => {
    // Keep steps in time order even if the recording clock ever went backwards.
    clock = Math.max(clock, Math.round(atMs));
    const next = { vi: reduceChatFlow(flows.vi, event("vi"), LABELS.vi), en: reduceChatFlow(flows.en, event("en"), LABELS.en) };
    const before = new Map(LOCALES.map((l) => [l, new Map(nodesOf(flows[l]).map(({ node }) => [node.id, node]))]));
    const enById = new Map(nodesOf(next.en).map(({ node }) => [node.id, node]));
    for (const { node: vi } of nodesOf(next.vi)) {
      const en = enById.get(vi.id);
      const prevVi = before.get("vi")!.get(vi.id);
      const prevEn = before.get("en")!.get(vi.id);
      const detailChanged = vi.detail !== prevVi?.detail || en?.detail !== prevEn?.detail;
      const metaChanged = vi.meta !== prevVi?.meta || en?.meta !== prevEn?.meta;
      const dataChanged = JSON.stringify(vi.data) !== JSON.stringify(prevVi?.data);
      if (vi.status === prevVi?.status && !detailChanged && !metaChanged && !dataChanged) continue;
      steps.push({
        atMs: clock,
        nodeId: vi.id,
        status: vi.status,
        ...(detailChanged && (vi.detail !== undefined || en?.detail !== undefined)
          ? { detail: { vi: vi.detail ?? "", en: en?.detail ?? "" } }
          : {}),
        ...(metaChanged && (vi.meta !== undefined || en?.meta !== undefined)
          ? { meta: { vi: vi.meta ?? "", en: en?.meta ?? "" } }
          : {}),
        ...(dataChanged && vi.data !== undefined
          ? {
              data: {
                title: { vi: vi.data.title, en: en?.data?.title ?? vi.data.title },
                hint: { vi: vi.data.hint, en: en?.data?.hint ?? vi.data.hint },
                value: vi.data.value,
                ...(vi.data.sources !== undefined ? { sources: vi.data.sources } : {}),
              },
            }
          : {}),
      });
    }
    flows = next;
  };

  // The question was sent at 0 ms.
  fold(0, () => ({ type: "submit" }));
  for (const { atMs, event } of events) fold(atMs, (locale) => localizedEvent(event, locale));

  const enNodes = new Map(nodesOf(flows.en).map((entry) => [entry.node.id, entry]));
  const nodes: ReplaySample["nodes"] = nodesOf(flows.vi).map(({ node, rowId, rowTitle }) => {
    const en = enNodes.get(node.id);
    return {
      id: node.id,
      label: { vi: node.label, en: en?.node.label ?? node.label },
      ...(node.sublabel !== undefined
        ? { sublabel: { vi: node.sublabel, en: en?.node.sublabel ?? node.sublabel } }
        : {}),
      ...(rowId !== "r1"
        ? {
            row: {
              id: rowId,
              ...(rowTitle !== undefined ? { title: { vi: rowTitle, en: en?.rowTitle ?? rowTitle } } : {}),
            },
          }
        : {}),
    };
  });

  const answer = events.findLast((e) => e.event.type === "answer")?.event;
  const failure = events.find((e) => e.event.type === "error")?.event;
  const text: Localized =
    answer?.type === "answer"
      ? { vi: answer.text, en: answer.text }
      : failure?.type === "error"
        ? { vi: T.vi(`errors.${chatErrorKey(failure.code)}`), en: T.en(`errors.${chatErrorKey(failure.code)}`) }
        : { vi: T.vi("errors.generic"), en: T.en("errors.generic") };

  return {
    id: options.id,
    title: options.title,
    input: { kind: "question", text: options.question, ...(options.lang ? { lang: options.lang } : {}) },
    nodes,
    steps,
    // An error text is ours, localized per UI language: only a real answer carries `lang`.
    result: { kind: "text", text, ...(options.lang && answer ? { lang: options.lang } : {}) },
  };
}
