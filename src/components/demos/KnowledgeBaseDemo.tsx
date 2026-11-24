"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { FlowPlayer, type FlowDataLabels } from "@/components/flow/FlowPlayer";
import { Markdown } from "@/components/Markdown";
import type { Locale } from "@/content/types";
import { ChatHttpError, fetchChatStatus, streamChat } from "@/lib/chat/client";
import { initialChatFlow, reduceChatFlow, type FlowLabels } from "@/lib/flow/chat-flow";
import { chatErrorKey, chatFlowLabels, type ChatEventErrorKey } from "@/lib/flow/chat-flow-labels";
import type { FlowState, NodeStatus } from "@/lib/flow/model";
import { markdownToPlain } from "@/lib/markdown-plain";

const MAX_QUESTION_CHARS = 500;

type DemoStatus = "loading" | "enabled" | "paused";
type ErrorKey = ChatEventErrorKey | "rateLimited" | "inviteRequired";
type InputErrorKey = "tooLong" | "invalidQuestion";
type FocusTarget = "input" | "newConversation" | "paused";

interface Turn {
  id: number;
  question: string;
  answer: string | null;
  error: ErrorKey | null;
}

const NODE_STATUSES: NodeStatus[] = ["idle", "active", "done", "error", "skipped"];
const CHIP_KEYS = ["c1", "c2", "c3"] as const;

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

export interface KnowledgeBaseDemoProps {
  /** Route locale; the rendered language comes from the surrounding NextIntlClientProvider. */
  locale: Locale;
  /**
   * Called when the server says the invite no longer works (401 `invite_required`),
   * so the caller can fall back to the replay. Without it the error shows in place.
   */
  onInviteRequired?: () => void;
}

/** Live Knowledge Base demo: the bot's real steps in a flow diagram above, the chat below. */
/**
 * The `locale` prop is accepted for the registry signature only: text and `lang`
 * both follow the active next-intl locale, so they can never disagree.
 */
export function KnowledgeBaseDemo({ onInviteRequired }: KnowledgeBaseDemoProps) {
  const t = useTranslations("kb");
  const activeLocale = useLocale();
  const inputId = useId();
  const inputErrorId = useId();

  const labels = useMemo<FlowLabels>(() => chatFlowLabels(t), [t]);

  const statusLabels = useMemo(
    () => Object.fromEntries(NODE_STATUSES.map((s) => [s, t(`statusLabels.${s}`)])) as Record<NodeStatus, string>,
    [t],
  );

  const dataLabels = useMemo<FlowDataLabels>(
    () => ({ open: t("inspect.open"), close: t("inspect.close"), hint: t("inspect.hint") }),
    [t],
  );

  const [status, setStatus] = useState<DemoStatus>("loading");
  const [flow, setFlow] = useState<FlowState>(() => initialChatFlow(labels));
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [inputError, setInputError] = useState<InputErrorKey | null>(null);
  const [running, setRunning] = useState(false);
  const [sessionFull, setSessionFull] = useState(false);
  /** Text of the single polite live region: a completed answer or a localized error. */
  const [announcement, setAnnouncement] = useState("");
  const [focusRequest, setFocusRequest] = useState<{ target: FocusTarget; seq: number } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const newConversationRef = useRef<HTMLButtonElement>(null);
  const pausedRef = useRef<HTMLHeadingElement>(null);

  const runningRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const flowRef = useRef(flow);
  const turnSeq = useRef(0);

  useEffect(() => {
    let cancelled = false;
    // No invite check here on purpose: `/api/chat/status` needs no session and always answers
    // 200 `{enabled}`, so it cannot report `invite_required`. An invite revoked between
    // `/api/session` and now surfaces on the first question (401 from `/api/chat/stream`),
    // which calls `onInviteRequired` and falls back to the replay.
    fetchChatStatus().then(({ enabled }) => {
      if (!cancelled) setStatus(enabled ? "enabled" : "paused");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Abort the in-flight request when the component goes away.
  useEffect(() => () => abortRef.current?.abort(), []);

  // Focus moves after the render that enables / creates the target, never onto a disabled element.
  useEffect(() => {
    if (!focusRequest) return;
    const el =
      focusRequest.target === "input"
        ? inputRef.current
        : focusRequest.target === "newConversation"
          ? newConversationRef.current
          : pausedRef.current;
    if (el && !(el instanceof HTMLInputElement && el.disabled)) el.focus();
  }, [focusRequest]);

  const requestFocus = useCallback((target: FocusTarget) => {
    setFocusRequest((prev) => ({ target, seq: (prev?.seq ?? 0) + 1 }));
  }, []);

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
      // Count code points, like the Python backend does.
      if ([...message].length > MAX_QUESTION_CHARS) {
        setInputError("tooLong");
        return;
      }

      runningRef.current = true;
      setRunning(true);
      setInputError(null);
      setInput("");
      setAnnouncement("");
      // The send button / chip gets disabled while running: keep focus on the input instead.
      requestFocus("input");
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
        setAnnouncement(t(`errors.${key}`));
        if (key === "sessionFull") requestFocus("newConversation");
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
            const key = chatErrorKey(event.code);
            if (key === "sessionFull") setSessionFull(true);
            fail(key);
            continue;
          }
          updateFlow(reduceChatFlow(flowRef.current, event, labels));
          if (event.type === "start") sessionIdRef.current = event.session_id;
          if (event.type === "answer") {
            answered = true;
            updateTurn(turnId, { answer: event.text });
            setAnnouncement(markdownToPlain(event.text));
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
              requestFocus("paused");
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
            case "rate_limited":
              // Too many runs at once on this invite: the visitor may simply try again later.
              fail("rateLimited");
              return;
            case "invite_required":
              fail("inviteRequired");
              onInviteRequired?.();
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
    [labels, onInviteRequired, requestFocus, sessionFull, t, updateFlow, updateTurn],
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
    setAnnouncement("");
    updateFlow(initialChatFlow(labels));
    requestFocus("input");
  }, [labels, requestFocus, updateFlow]);

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
    <div lang={activeLocale} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between font-mono text-label-mono-sm tracking-wider text-outline uppercase">
          <span>{t("flowTitle")}</span>
          <span role="status" className="font-medium text-secondary">
            {t(`runStatus.${runStatus}`)}
          </span>
        </div>
        <FlowPlayer state={flow} label={t("flowLabel")} statusLabels={statusLabels} dataLabels={dataLabels} />
      </div>

      <section
        aria-label={t("chatLabel")}
        className="flex min-h-[250px] flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container p-4"
      >
        {status === "paused" ? (
          <div className="flex flex-col gap-1 rounded-lg border border-outline-variant bg-surface-container-low p-4">
            <h3 ref={pausedRef} tabIndex={-1} className="text-headline-md text-on-surface">{t("paused.title")}</h3>
            <p className="text-body-md text-on-surface-variant">{t("paused.body")}</p>
          </div>
        ) : (
          <>
            {/* Only completed answers and localized errors are announced, once each. */}
            <div aria-live="polite" aria-atomic="true" data-role="live" className="sr-only">
              {announcement}
            </div>
            <div className="flex flex-col gap-2.5">
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
                    <div
                      data-role="bot"
                      className="w-full max-w-[92%] self-start rounded-xl border border-primary-container/50 bg-primary-container/20 px-3.5 py-2.5 text-body-md text-on-surface sm:max-w-[82%]"
                    >
                      <span className="sr-only">{t("bot")}: </span>
                      <Markdown>{turn.answer}</Markdown>
                    </div>
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
                ref={newConversationRef}
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
                  ref={inputRef}
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
