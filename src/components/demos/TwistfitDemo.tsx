"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/content/types";
import { assetUrl, fetchCatalog, pollJob, resultUrl, startRun, TwistfitError } from "@/lib/twistfit/client";
import type { CatalogEntry, JobStatus, TwistfitCatalog } from "@/lib/twistfit/types";

type Step = 1 | 2 | 3;
type ErrorKey = "busy" | "limit" | "moderated" | "timeout" | "generic" | "inviteRequired" | "resultExpired";
type FocusTarget = "step" | "result" | "error" | "catalogError";

type CatalogState =
  | { kind: "loading" }
  | { kind: "ready"; catalog: TwistfitCatalog }
  | { kind: "error"; invite: boolean };

type RunState =
  | { phase: "idle" }
  | { phase: "running"; status: JobStatus | null }
  | { phase: "done"; resultId: string }
  | { phase: "error"; key: ErrorKey };

const STEP_KEYS = ["items", "model", "generate"] as const;

/** Friendly message key for a server/job/client error code; never shows the code itself. */
function errorKey(code: string | undefined): ErrorKey {
  switch (code) {
    case "busy":
      return "busy";
    case "twistfit_limit":
      return "limit";
    case "flux_moderated":
      return "moderated";
    case "flux_timeout":
      return "timeout";
    case "invite_required":
      return "inviteRequired";
    default:
      return "generic";
  }
}

function isAbortError(err: unknown): boolean {
  return (err instanceof Error || err instanceof DOMException) && err.name === "AbortError";
}

const PRIMARY_BUTTON =
  "inline-flex min-h-11 items-center justify-center rounded-lg bg-primary-container px-4 py-2.5 text-body-md font-semibold text-on-primary-container disabled:cursor-not-allowed disabled:opacity-50";
const SECONDARY_BUTTON =
  "inline-flex min-h-11 items-center justify-center rounded-lg border border-secondary px-4 py-2.5 text-body-md text-secondary hover:bg-secondary/10 disabled:cursor-not-allowed disabled:opacity-50";
const CHOICE_CARD =
  "flex cursor-pointer flex-col gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest p-2 hover:border-secondary has-checked:border-secondary has-checked:bg-secondary/10 has-[[aria-disabled=true]]:cursor-not-allowed has-[[aria-disabled=true]]:opacity-50 has-[[aria-disabled=true]]:hover:border-outline-variant";
/**
 * Thumbnail box: 4:5 but never taller than 13rem, so a row of cards stays compact on wide
 * screens; `object-contain` on a neutral surface never crops a garment or a model.
 */
const THUMB = "block aspect-[4/5] max-h-52 w-full rounded-md bg-surface-container-high object-contain";
/** Choice grids: 2 columns on phones, 3 from md, 4 from lg. */
const CHOICE_GRID = "grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-4";

export interface TwistfitDemoProps {
  /** Route locale; text and names follow the surrounding NextIntlClientProvider (same value). */
  locale: Locale;
  /** Called when the server says the invite no longer works (401), so the caller can show the replay. */
  onInviteRequired: () => void;
}

/** Live Twistfit demo: pick items, pick a model, then generate a try-on image with Flux. */
export function TwistfitDemo({ onInviteRequired }: TwistfitDemoProps) {
  const t = useTranslations("twistfit.live");
  const activeLocale = useLocale();
  const lang: Locale = activeLocale === "en" ? "en" : "vi";
  const headingId = useId();
  const hintId = useId();
  const countId = useId();

  const [catalogState, setCatalogState] = useState<CatalogState>({ kind: "loading" });
  const [step, setStep] = useState<Step>(1);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [model, setModel] = useState<string | null>(null);
  const [run, setRun] = useState<RunState>({ phase: "idle" });
  const [focusRequest, setFocusRequest] = useState<{ target: FocusTarget; seq: number } | null>(null);

  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const catalogErrorRef = useRef<HTMLParagraphElement>(null);

    const runAbortRef = useRef<AbortController | null>(null);
  const runningRef = useRef(false);
  const onInviteRequiredRef = useRef(onInviteRequired);
  useEffect(() => {
    onInviteRequiredRef.current = onInviteRequired;
  }, [onInviteRequired]);

  const requestFocus = useCallback((target: FocusTarget) => {
    setFocusRequest((prev) => ({ target, seq: (prev?.seq ?? 0) + 1 }));
  }, []);

  // Focus moves only on explicit requests (step change, result, error), never on status updates.
  useEffect(() => {
    if (!focusRequest) return;
    const el = {
      step: stepHeadingRef,
      result: resultHeadingRef,
      error: errorRef,
      catalogError: catalogErrorRef,
    }[focusRequest.target].current;
    el?.focus();
  }, [focusRequest]);

  /** Bumped by "Try again" to load the catalog once more. */
  const [catalogAttempt, setCatalogAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
        fetchCatalog(controller.signal).then(
      (catalog) => {
        if (controller.signal.aborted) return;
        setCatalogState({ kind: "ready", catalog });
        // After a retry the button is gone: give focus a home instead of letting it drop to <body>.
        if (catalogAttempt > 0) requestFocus("step");
      },
      (err: unknown) => {
        if (controller.signal.aborted || isAbortError(err)) return;
        const invite = err instanceof TwistfitError && err.code === "invite_required";
        setCatalogState({ kind: "error", invite });
        requestFocus("catalogError");
        if (invite) onInviteRequiredRef.current();
      },
    );
    return () => controller.abort();
  }, [catalogAttempt, requestFocus]);

  const retryCatalog = () => {
    setCatalogState({ kind: "loading" });
    setCatalogAttempt((n) => n + 1);
  };

  // Cancel the run (start request or polling) when the component goes away.
  useEffect(
    () => () => {
      runAbortRef.current?.abort();
    },
    [],
  );

  const catalog = catalogState.kind === "ready" ? catalogState.catalog : null;
  const chosenItems: CatalogEntry[] = catalog ? catalog.items.filter((item) => selected.has(item.id)) : [];
  const chosenModel: CatalogEntry | null = (catalog && catalog.models.find((m) => m.id === model)) ?? null;
  const running = run.phase === "running";

  const goTo = (next: Step) => {
    setStep(next);
    requestFocus("step");
  };

  const toggleItem = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (catalog && next.size < catalog.max_items) next.add(id);
      return next;
    });
  };

  const generate = async () => {
    if (runningRef.current || !chosenModel || chosenItems.length === 0) return;
    runningRef.current = true;
    const controller = new AbortController();
    runAbortRef.current = controller;
    setRun({ phase: "running", status: null });

    const fail = (key: ErrorKey) => {
      setRun({ phase: "error", key });
      requestFocus("error");
      if (key === "inviteRequired") onInviteRequiredRef.current();
    };

    try {
      const { jobId } = await startRun(
        { items: chosenItems.map((item) => item.id), model: chosenModel.id },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      const final = await pollJob(jobId, {
        signal: controller.signal,
        onUpdate: (status) => {
          if (!controller.signal.aborted && status.status === "running") setRun({ phase: "running", status });
        },
      });
      if (controller.signal.aborted) return;
      if (final.status === "done" && final.result_id) {
        setRun({ phase: "done", resultId: final.result_id });
        requestFocus("result");
      } else {
        fail(errorKey(final.code));
      }
    } catch (err) {
      if (controller.signal.aborted || isAbortError(err)) return;
      fail(errorKey(err instanceof TwistfitError ? err.code : undefined));
    } finally {
      if (runAbortRef.current === controller) {
        runAbortRef.current = null;
        runningRef.current = false;
      }
    }
  };

  /** "Try again" in the error alert: the alert goes away, so focus goes to the step heading. */
  const retryRun = () => {
    requestFocus("step");
    void generate();
  };

  /** The result image could not be loaded (expired, evicted or lost on restart). */
  const resultFailed = () => {
    setRun({ phase: "error", key: "resultExpired" });
    requestFocus("error");
  };

  const backToModel = () => {
    setRun({ phase: "idle" });
    goTo(2);
  };

  const startOver = () => {
    setRun({ phase: "idle" });
    goTo(1);
  };

  const stepHeading = (key: (typeof STEP_KEYS)[number]) => (
    <h3
      id={headingId}
      ref={stepHeadingRef}
      tabIndex={-1}
      className="font-mono text-label-mono-sm tracking-wider text-outline uppercase"
    >
      {t(`steps.${key}`)}
    </h3>
  );

  const stageText =
    run.phase === "running" ? t(`stages.${run.status ? (run.status.stage ?? "merging") : "starting"}`) : "";
  const waitingSeconds =
    run.phase === "running" && run.status?.stage === "waiting" ? run.status.elapsed_seconds : null;

  return (
    <section
      lang={activeLocale}
      aria-label={t("label")}
      className="flex flex-col gap-4 rounded-xl border border-outline-variant bg-surface-container p-4"
    >
      <ol aria-label={t("stepsLabel")} className="m-0 flex list-none flex-wrap gap-x-4 gap-y-2 p-0">
        {STEP_KEYS.map((key, i) => {
          const n = (i + 1) as Step;
          const current = n === step;
          return (
            <li
              key={key}
              aria-current={current ? "step" : undefined}
              className={`flex items-center gap-2 text-body-md ${current ? "font-semibold text-on-surface" : "text-on-surface-variant"}`}
            >
              <span
                aria-hidden="true"
                className={`inline-flex size-6 items-center justify-center rounded-full border font-mono text-label-mono-sm ${
                  current
                    ? "border-secondary bg-secondary/10 text-secondary"
                    : n < step
                      ? "border-secondary text-secondary"
                      : "border-outline-variant text-outline"
                }`}
              >
                {n}
              </span>
              <span className="sr-only">{n} </span>
              {t(`steps.${key}`)}
            </li>
          );
        })}
      </ol>

      {catalogState.kind === "loading" ? (
        <p className="text-body-md text-on-surface-variant">{t("loading")}</p>
      ) : null}

      {catalogState.kind === "error" ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-lg border border-error/60 bg-error-container/30 p-4"
        >
          <p ref={catalogErrorRef} tabIndex={-1} className="text-body-md text-on-error-container">
            {catalogState.invite ? t("errors.inviteRequired") : t("unavailable")}
          </p>
          {catalogState.invite ? null : (
            <button type="button" onClick={retryCatalog} className={SECONDARY_BUTTON}>
              {t("retry")}
            </button>
          )}
        </div>
      ) : null}

      {catalog && step === 1 ? (
        <div role="group" aria-labelledby={headingId} className="flex flex-col gap-3">
          {stepHeading("items")}
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p id={hintId} className="text-body-md text-on-surface-variant">
              {t("items.hint", { max: catalog.max_items })}
            </p>
            <p id={countId} role="status" className="font-mono text-label-mono-sm text-secondary">
              {t("items.count", { count: selected.size, max: catalog.max_items })}
            </p>
          </div>
          <ul role="list" className={`m-0 list-none p-0 ${CHOICE_GRID}`}>
            {catalog.items.map((item) => {
              const checked = selected.has(item.id);
              const name = item.name[lang];
              // At the limit, unchecked items stay focusable (aria-disabled) and say why.
              const full = !checked && selected.size >= catalog.max_items;
              return (
                <li key={item.id}>
                  <label className={CHOICE_CARD}>
                    {/* Proxied catalog photos: a plain <img> keeps them off the image optimizer.
                        Decorative here: the control already carries the name. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={assetUrl("items", item.id)}
                      alt=""
                      width={300}
                      height={400}
                      loading="lazy"
                      decoding="async"
                      className={THUMB}
                    />
                    <span className="flex min-h-11 items-center gap-2 text-body-md text-on-surface">
                      <input
                        type="checkbox"
                        aria-label={name}
                        checked={checked}
                        aria-disabled={full ? true : undefined}
                        aria-describedby={full ? `${countId} ${hintId}` : undefined}
                        onChange={() => toggleItem(item.id)}
                        className="size-5 shrink-0 accent-secondary"
                      />
                      <span aria-hidden="true" className="break-words">
                        {name}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="flex justify-end">
            <button type="button" disabled={selected.size === 0} onClick={() => goTo(2)} className={PRIMARY_BUTTON}>
              {t("next")}
            </button>
          </div>
        </div>
      ) : null}

      {catalog && step === 2 ? (
        <div className="flex flex-col gap-3">
          {stepHeading("model")}
          <p className="text-body-md text-on-surface-variant">{t("model.hint")}</p>
          <div role="radiogroup" aria-labelledby={headingId} className={CHOICE_GRID}>
            {catalog.models.map((entry) => {
              const name = entry.name[lang];
              return (
                <label key={entry.id} className={CHOICE_CARD}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={assetUrl("models", entry.id)}
                    alt=""
                    width={300}
                    height={400}
                    loading="lazy"
                    decoding="async"
                    className={THUMB}
                  />
                  <span className="flex min-h-11 items-center gap-2 text-body-md text-on-surface">
                    <input
                      type="radio"
                      name={`${headingId}-model`}
                      aria-label={name}
                      checked={model === entry.id}
                      onChange={() => setModel(entry.id)}
                      className="size-5 shrink-0 accent-secondary"
                    />
                    <span aria-hidden="true" className="break-words">
                      {name}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <button type="button" onClick={() => goTo(1)} className={SECONDARY_BUTTON}>
              {t("back")}
            </button>
            <button type="button" disabled={!chosenModel} onClick={() => goTo(3)} className={PRIMARY_BUTTON}>
              {t("next")}
            </button>
          </div>
        </div>
      ) : null}

      {catalog && step === 3 ? (
        <section
          aria-labelledby={headingId}
          className={`flex flex-col gap-3 ${
            // With a result, wide screens put it beside the summary and actions (DOM order kept).
            run.phase === "done"
              ? "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:grid-rows-[auto_auto_auto_1fr] lg:gap-x-6 lg:[&>*]:col-start-1"
              : ""
          }`}
        >
          {stepHeading("generate")}
          <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-body-md">
            <dt className="text-on-surface-variant">{t("summary.items")}</dt>
            <dd className="m-0 break-words text-on-surface">{chosenItems.map((item) => item.name[lang]).join(", ")}</dd>
            <dt className="text-on-surface-variant">{t("summary.model")}</dt>
            <dd className="m-0 break-words text-on-surface">{chosenModel?.name[lang]}</dd>
          </dl>

          <div className="flex min-h-6 flex-wrap items-center gap-x-2 text-body-md text-on-surface-variant">
            {running ? (
              <span
                aria-hidden="true"
                className="inline-block size-2 animate-pulse rounded-full bg-secondary motion-reduce:animate-none"
              />
            ) : null}
            {/* The live region only changes with the stage; the ticking seconds stay outside it. */}
            <p role="status" className="m-0">
              {stageText}
            </p>
            {waitingSeconds !== null ? (
              <span className="font-mono text-label-mono-sm text-secondary">
                {t("elapsed", { seconds: waitingSeconds })}
              </span>
            ) : null}
          </div>

          {run.phase === "error" ? (
            <div
              role="alert"
              className="flex flex-col items-start gap-3 rounded-lg border border-error/60 bg-error-container/30 p-4"
            >
              <p ref={errorRef} tabIndex={-1} className="text-body-md text-on-error-container">
                {t(`errors.${run.key}`)}
              </p>
              {run.key === "limit" || run.key === "inviteRequired" ? null : (
                <button type="button" onClick={retryRun} className={SECONDARY_BUTTON}>
                  {t("retry")}
                </button>
              )}
            </div>
          ) : null}

          {run.phase === "done" ? (
            <div className="flex flex-col gap-3 lg:col-start-2! lg:row-span-4 lg:row-start-1">
              <h4 ref={resultHeadingRef} tabIndex={-1} className="text-headline-md text-on-surface">
                {t("result.title")}
              </h4>
              {/* The result is served once by the proxy: a plain <img>, no optimizer. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resultUrl(run.resultId)}
                alt={t("result.alt", {
                  model: chosenModel?.name[lang] ?? "",
                  items: chosenItems.map((item) => item.name[lang]).join(", "),
                })}
                width={768}
                height={1024}
                onError={resultFailed}
                className="block h-auto max-h-[70vh] w-full max-w-sm rounded-lg border border-outline-variant bg-surface-container-high object-contain lg:max-w-none"
              />
            </div>
          ) : null}

          {run.phase === "done" ? (
            // Primary action first; on phones it takes a full row and the other two share one.
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:self-start">
              <button type="button" onClick={startOver} className={`col-span-2 ${PRIMARY_BUTTON}`}>
                {t("regenerate")}
              </button>
              <a href={resultUrl(run.resultId)} download="twistfit.png" className={SECONDARY_BUTTON}>
                {t("download")}
              </a>
              <button type="button" onClick={backToModel} className={SECONDARY_BUTTON}>
                {t("back")}
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap justify-between gap-2">
              <button type="button" disabled={running} onClick={backToModel} className={SECONDARY_BUTTON}>
                {t("back")}
              </button>
              {run.phase === "error" ? null : (
                <button type="button" disabled={running} onClick={() => void generate()} className={PRIMARY_BUTTON}>
                  {t("generate")}
                </button>
              )}
            </div>
          )}
        </section>
      ) : null}

      <div className="flex flex-col gap-0.5 text-label-mono-sm text-outline">
        <p>{t("notes.source")}</p>
        <p>{t("notes.flux")}</p>
        <p>{t("notes.privacy")}</p>
      </div>
    </section>
  );
}
