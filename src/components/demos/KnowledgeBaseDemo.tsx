"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { FlowPlayer } from "@/components/flow/FlowPlayer";
import type { Locale } from "@/content/types";
import { ChatHttpError, fetchChatStatus, streamChat } from "@/lib/chat/client";
import type { ChatEvent } from "@/lib/chat/types";
import { initialChatFlow, reduceChatFlow, type FlowLabels } from "@/lib/flow/chat-flow";
import type { FlowState, NodeStatus } from "@/lib/flow/model";

const MAX_QUESTION_CHARS = 500;
const TYPING_INTERVAL_MS = 16;
/** Long answers type faster so the whole text takes at most ~200 ticks. */
const TYPING_MAX_TICKS = 200;

type DemoStatus = "loading" | "enabled" | "paused";
type ErrorKey = "sessionFull" | "model" | "generic";
type InputErrorKey = "tooLong" | "invalidQuestion";

interface Turn {
  id: number;
  question: string;
  answer: string | null;
  error: ErrorKey | null;
}

const NODE_STATUSES: NodeStatus[] = ["idle", "active", "done", "error", "skipped"];
const CHIP_KEYS = ["c1", "c2", "c3"] as const;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

function errorKeyFor(event: Extract<ChatEvent, { type: "error" }>): ErrorKey {
  switch (event.code) {
    case "session_full":
      return "sessionFull";
    case "model":
      return "model";
    default:
      return "generic";
  }
}

/** Types `text` out progressively, or shows it at once under reduced motion. */
function TypedText({ text }: { text: string }) {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? text.length : 0));

  const typing = shown < text.length;

  useEffect(() => {
    if (!typing) return;
    const step = Math.max(1, Math.ceil(text.length / TYPING_MAX_TICKS));
    const timer = setInterval(() => setShown((n) => Math.min(text.length, n + step)), TYPING_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [typing, text]);

  return (
    <span aria-busy={typing || undefined}>
      {text.slice(0, shown)}
      {typing ? (
        <span
          aria-hidden="true"
          className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-secondary align-[-2px] motion-reduce:animate-none"
        />
      ) : null}
    </span>
  );
}

export interface KnowledgeBaseDemoProps {
  /** Must match the locale of the surrounding NextIntlClientProvider. */
  locale: Locale;
}

/** Live Knowledge Base demo: the bot's real steps in a flow diagram above, the chat below. */
export function KnowledgeBaseDemo({ locale }: KnowledgeBaseDemoProps) {
  const t = useTranslations("kb");
  const inputId = useId();
  const inputErrorId = useId();

  const labels = useMemo<FlowLabels>(
    () => ({
      question: { label: t("nodes.question.label"), sublabel: t("nodes.question.sublabel") },
      model: { label: t("nodes.model.label"), sublabel: t("nodes.model.sublabel") },
      tool: { label: t("nodes.tool.label"), sublabel: t("nodes.tool.sublabel") },
      database: { label: t("nodes.database.label"), sublabel: t("nodes.database.sublabel") },
      answer: { label: t("nodes.answer.label"), sublabel: t("nodes.answer.sublabel") },
      extraCall: (n) => t("extraCall", { n }),
      rowCount: (count) => t("rowCount", { count }),
    }),
    [t],
  );

  const statusLabels = useMemo(
    () => Object.fromEntries(NODE_STATUSES.map((s) => [s, t(`statusLabels.${s}`)])) as Record<NodeStatus, string>,
    [t],
  );

  const [status, setStatus] = useState<DemoStatus>("loading");
  const [flow, setFlow] = useState<FlowState>(() => initialChatFlow(labels));
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [inputError, setInputError] = useState<InputErrorKey | null>(null);
  const [running, setRunning] = useState(false);
  const [sessionFull, setSessionFull] = useState(false);

  const runningRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const flowRef = useRef(flow);
  const turnSeq = useRef(0);

  useEffect(() => {
    let cancelled = false;
    fetchChatStatus().then(({ enabled }) => {
      if (!cancelled) setStatus(enabled ? "enabled" : "paused");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Abort the in-flight request when the component goes away.
  useEffect(() => () => abortRef.current?.abort(), []);

  const updateFlow = useCallback((next: FlowState) => {
    flowRef.current = next;
    setFlow(next);
  }, []);

  const updateTurn = useCallback((id: number, patch: Partial<Turn>) => {
    setTurns((all) => all.map((turn) => (turn.id === id ? { ...turn, ...patch } : turn)));
  }, []);

  const send = useCallback(
    async (raw: string) => {
      const message = raw.trim();
      if (message === "" || runningRef.current || sessionFull) return;
      if (message.length > MAX_QUESTION_CHARS) {
        setInputError("tooLong");
        return;
      }

      runningRef.current = true;
      setRunning(true);
      setInputError(null);
      setInput("");
      const turnId = ++turnSeq.current;
      setTurns((all) => [...all, { id: turnId, question: message, answer: null, error: null }]);
      updateFlow(reduceChatFlow(flowRef.current, { type: "submit" }, labels));

      const controller = new AbortController();
      abortRef.current = controller;
      let answered = false;
      let failed = false;

      const fail = (key: ErrorKey) => {
        failed = true;
        updateTurn(turnId, { error: key });
        // Mark the running steps as failed with our own text, never the upstream message.
        updateFlow(
          reduceChatFlow(flowRef.current, { type: "error", code: "internal", message: t(`errors.${key}`) }, labels),
        );
      };

      try {
        const events = streamChat({ message, sessionId: sessionIdRef.current }, controller.signal);
        for await (const event of events) {
          if (controller.signal.aborted) return;
          if (event.type === "error") {
            const key = errorKeyFor(event);
            if (key === "sessionFull") setSessionFull(true);
            fail(key);
            continue;
          }
          updateFlow(reduceChatFlow(flowRef.current, event, labels));
          if (event.type === "start") sessionIdRef.current = event.session_id;
          if (event.type === "answer") {
            answered = true;
            updateTurn(turnId, { answer: event.text });
          }
        }
        if (!answered && !failed && !controller.signal.aborted) fail("generic");
      } catch (err) {
        if (controller.signal.aborted || isAbortError(err)) return;
        if (err instanceof ChatHttpError) {
          switch (err.code) {
            case "demo_disabled":
              updateFlow(initialChatFlow(labels));
              setStatus("paused");
              return;
            case "too_long":
            case "invalid_question":
              // The question was rejected before processing: give it back for editing.
              setTurns((all) => all.filter((turn) => turn.id !== turnId));
              updateFlow(initialChatFlow(labels));
              setInput(message);
              setInputError(err.code === "too_long" ? "tooLong" : "invalidQuestion");
              return;
            case "session_full":
              setSessionFull(true);
              fail("sessionFull");
              return;
          }
        }
        fail("generic");
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          runningRef.current = false;
          setRunning(false);
        }
      }
    },
    [labels, sessionFull, t, updateFlow, updateTurn],
  );

  const newConversation = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    runningRef.current = false;
    sessionIdRef.current = null;
    setRunning(false);
    setTurns([]);
    setSessionFull(false);
    setInputError(null);
    updateFlow(initialChatFlow(labels));
  }, [labels, updateFlow]);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void send(input);
  };

  const lastTurn = turns.at(-1);
  const runStatus = running
    ? "running"
    : lastTurn?.error
      ? "error"
      : lastTurn?.answer !== null && lastTurn !== undefined
        ? "done"
        : "idle";
  const blocked = status !== "enabled" || running || sessionFull;

  return (
    <div lang={locale} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between font-mono text-label-mono-sm tracking-wider text-outline uppercase">
          <span>{t("flowTitle")}</span>
          <span role="status" className="font-medium text-secondary">
            {t(`runStatus.${runStatus}`)}
          </span>
        </div>
        <FlowPlayer state={flow} label={t("flowLabel")} statusLabels={statusLabels} />
      </div>

      <section
        aria-label={t("chatLabel")}
        className="flex min-h-[250px] flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container p-4"
      >
        {status === "paused" ? (
          <div className="flex flex-col gap-1 rounded-lg border border-outline-variant bg-surface-container-low p-4">
            <h3 className="text-headline-md text-on-surface">{t("paused.title")}</h3>
            <p className="text-body-md text-on-surface-variant">{t("paused.body")}</p>
          </div>
        ) : (
          <>
            <div aria-live="polite" className="flex flex-col gap-2.5">
              {turns.length === 0 ? (
                <p className="text-body-md text-on-surface-variant">
                  {status === "loading" ? t("loading") : t("emptyHint")}
                </p>
              ) : null}
              {turns.map((turn) => (
                <div key={turn.id} className="flex flex-col gap-2.5">
                  <p
                    data-role="user"
                    className="max-w-[82%] self-end rounded-xl bg-surface-container-high px-3.5 py-2.5 text-body-md break-words text-on-surface"
                  >
                    <span className="sr-only">{t("you")}: </span>
                    {turn.question}
                  </p>
                  {turn.answer !== null ? (
                    <p
                      data-role="bot"
                      className="max-w-[82%] self-start rounded-xl border border-primary-container/50 bg-primary-container/20 px-3.5 py-2.5 text-body-md break-words whitespace-pre-wrap text-on-surface"
                    >
                      <TypedText text={turn.answer} />
                    </p>
                  ) : null}
                  {turn.error ? (
                    <p
                      data-role="error"
                      className="max-w-[82%] self-start rounded-xl border border-error/60 bg-error-container/30 px-3.5 py-2.5 text-body-md text-on-error-container"
                    >
                      {t(`errors.${turn.error}`)}
                    </p>
                  ) : null}
                  {turn.answer === null && !turn.error && running && turn.id === lastTurn?.id ? (
                    <p className="self-start text-body-md text-on-surface-variant">{t("thinking")}</p>
                  ) : null}
                </div>
              ))}
            </div>

            {turns.length > 0 ? (
              <button
                type="button"
                onClick={newConversation}
                className="self-start rounded-lg border border-secondary px-3 py-1.5 text-body-md text-secondary hover:bg-secondary/10"
              >
                {t("newConversation")}
              </button>
            ) : null}

            <div role="group" aria-label={t("chipsLabel")} className="mt-auto flex flex-wrap gap-1.5">
              {CHIP_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  disabled={blocked}
                  onClick={() => void send(t(`chips.${key}`))}
                  className="rounded-full border border-outline-variant px-3 py-1 text-left text-code-block text-on-surface-variant hover:border-secondary hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t(`chips.${key}`)}
                </button>
              ))}
            </div>

            <form onSubmit={onSubmit} noValidate className="flex flex-col gap-1.5">
              <label htmlFor={inputId} className="sr-only">
                {t("inputLabel")}
              </label>
              <div className="flex gap-2">
                <input
                  id={inputId}
                  type="text"
                  autoComplete="off"
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    if (inputError) setInputError(null);
                  }}
                  disabled={status !== "enabled" || sessionFull}
                  placeholder={t("placeholder")}
                  aria-invalid={inputError ? true : undefined}
                  aria-describedby={inputError ? inputErrorId : undefined}
                  className="min-w-0 flex-1 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-body-md text-on-surface placeholder:text-outline aria-invalid:border-error disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={blocked}
                  className="rounded-lg bg-primary-container px-4 py-2.5 text-body-md font-semibold text-on-primary-container disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t("send")}
                </button>
              </div>
              {inputError ? (
                <p id={inputErrorId} role="alert" className="text-body-md text-error">
                  {t(`errors.${inputError}`)}
                </p>
              ) : null}
            </form>
          </>
        )}
        <div className="flex flex-col gap-0.5 text-label-mono-sm text-outline">
          <p>{t("notes.synthetic")}</p>
          <p>{t("notes.privacy")}</p>
        </div>
      </section>
    </div>
  );
}
