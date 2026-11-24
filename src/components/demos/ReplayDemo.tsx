"use client";

import { useId, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { FlowPlayer, type FlowDataLabels } from "@/components/flow/FlowPlayer";
import { Markdown } from "@/components/Markdown";
import { placeholderVariantOf } from "@/content/replays/placeholder";
import type { ReplayDefinition, ReplaySample } from "@/content/replays/types";
import type { Locale, Localized } from "@/content/types";
import type { NodeStatus } from "@/lib/flow/model";
import { useReplay } from "@/lib/replay/use-replay";
import { DemoBadge, DemoBadgeQualifier, usePageBadge } from "./DemoBadge";

const NODE_STATUSES: NodeStatus[] = ["idle", "active", "done", "error", "skipped"];
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const mql = window.matchMedia(REDUCED_MOTION_QUERY);
  mql.addEventListener?.("change", onChange);
  return () => mql.removeEventListener?.("change", onChange);
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

type People = Extract<ReplaySample["result"], { kind: "people" }>["people"];
type Person = People[number];

/**
 * Generation of each person: 1 + the deepest parent's generation. Someone who
 * married in (no parents listed) takes the generation of a co-parent of their child.
 */
function generations(people: People): Map<string, number> {
  const byId = new Map(people.map((p) => [p.id, p]));
  const memo = new Map<string, number>();
  const ofLineage = (id: string, seen: Set<string>): number => {
    const known = memo.get(id);
    if (known !== undefined) return known;
    const person = byId.get(id);
    if (!person || seen.has(id)) return 1;
    seen.add(id);
    const gen =
      person.parentIds.length === 0
        ? 1
        : 1 + Math.max(...person.parentIds.map((pid) => ofLineage(pid, seen)));
    memo.set(id, gen);
    return gen;
  };
  const result = new Map<string, number>();
  for (const person of people) result.set(person.id, ofLineage(person.id, new Set()));
  for (const person of people) {
    if (person.parentIds.length > 0) continue;
    const coParents = people
      .filter((child) => child.parentIds.includes(person.id))
      .flatMap((child) => child.parentIds)
      .filter((pid) => pid !== person.id && (byId.get(pid)?.parentIds.length ?? 0) > 0);
    if (coParents.length > 0) result.set(person.id, Math.max(...coParents.map((pid) => result.get(pid) ?? 1)));
  }
  return result;
}

function lifeSpan(person: Person, born: (year: number) => string): string | null {
  if (person.birthYear && person.deathYear) return `${person.birthYear}–${person.deathYear}`;
  if (person.birthYear) return born(person.birthYear);
  if (person.deathYear) return `?–${person.deathYear}`;
  return null;
}

function PeopleResult({ people }: { people: People }) {
  const t = useTranslations("demo.people");
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const groups = useMemo(() => {
    const gens = generations(people);
    const map = new Map<number, Person[]>();
    for (const person of people) {
      const gen = gens.get(person.id) ?? 1;
      map.set(gen, [...(map.get(gen) ?? []), person]);
    }
    return [...map.entries()].sort(([a], [b]) => a - b);
  }, [people]);

  return (
    <div aria-label={t("treeLabel")} role="group" className="flex flex-col gap-3">
      {groups.map(([gen, members]) => (
        <section key={gen} className="flex flex-col gap-1.5">
          <h4 className="font-mono text-label-mono-sm tracking-wider text-outline uppercase">
            {t("generation", { n: gen })}
          </h4>
          <ul role="list" className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2">
            {members.map((person) => {
              const span = lifeSpan(person, (year) => t("born", { year: String(year) }));
              const parents = person.parentIds.map((pid) => byId.get(pid)?.name ?? pid);
              return (
                <li
                  key={person.id}
                  data-person-id={person.id}
                  className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2"
                >
                  <p className="text-body-md font-semibold text-on-surface">
                    {person.name}
                    {span ? <span className="ml-1.5 font-normal text-on-surface-variant">({span})</span> : null}
                  </p>
                  <p className="text-code-block text-on-surface-variant">
                    {parents.length > 0
                      ? t("childOf", { parents: parents.join(` ${t("and")} `) })
                      : t("noParents")}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ImageGrid({
  items,
  locale,
  placeholder,
  ribbon,
}: {
  items: { src: string; alt: Localized }[];
  locale: Locale;
  placeholder: boolean;
  ribbon: string;
}) {
  return (
    <ul role="list" className="m-0 grid list-none grid-cols-2 gap-2.5 p-0 sm:grid-cols-4">
      {items.map((item) => (
        <li key={item.src} className="relative overflow-hidden rounded-lg border border-outline-variant">
          {/* SVG placeholders: a plain <img> avoids the image optimizer, which refuses SVG. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.src} alt={item.alt[locale]} width={300} height={400} className="block h-auto w-full" />
          {placeholder ? (
            <span className="absolute inset-x-0 top-0 bg-error-container px-2 py-1 text-center font-mono text-label-mono-sm font-semibold tracking-wider text-on-error-container uppercase">
              {ribbon}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export interface ReplayDemoProps {
  definition: ReplayDefinition;
  kind: "replay" | "simulation";
  /** Route locale (registry signature); text follows the active next-intl locale. */
  locale: Locale;
  /** Extra honesty note shown under the demo. */
  footnote?: ReactNode;
}

/** Plays back a recorded (or simulated) run: badge, sample picker, input, flow, then result. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ReplayDemo({ definition, kind, locale: _locale, footnote }: ReplayDemoProps) {
  const t = useTranslations("demo");
  const locale = useLocale() as Locale;
  const inputHeadingId = useId();
  const resultHeadingId = useId();
  const [sampleId, setSampleId] = useState(definition.samples[0]?.id);
  const sample = definition.samples.find((s) => s.id === sampleId) ?? definition.samples[0];
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, () => false);
  const { flow, status, showResult, play } = useReplay(sample, locale, { reducedMotion });

  const dataLabels = useMemo<FlowDataLabels>(
    () => ({ open: t("inspect.open"), close: t("inspect.close"), hint: t("inspect.hint") }),
    [t],
  );
  const statusLabels = useMemo(
    () => Object.fromEntries(NODE_STATUSES.map((s) => [s, t(`statusLabels.${s}`)])) as Record<NodeStatus, string>,
    [t],
  );

  const placeholder = sample.placeholder === true;
  // Worded after the data: "images and facts" only when the samples show images.
  const variant = placeholderVariantOf(definition.samples);
  const ribbon = t("placeholder.ribbon");
  const pageBadge = usePageBadge();

  return (
    <div lang={locale} className="flex flex-col gap-4">
      {pageBadge.active ? (
        placeholder && !pageBadge.qualifier ? <DemoBadgeQualifier qualifier={variant} /> : null
      ) : (
        <DemoBadge kind={kind} locale={locale} qualifier={placeholder ? variant : undefined} />
      )}

      {definition.samples.length > 1 ? (
        <div role="group" aria-label={t("samplesLabel")} className="flex flex-wrap gap-1.5">
          {definition.samples.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={s.id === sample.id}
              onClick={() => setSampleId(s.id)}
              className="rounded-full border border-outline-variant px-3 py-1 text-body-md text-on-surface-variant hover:border-secondary hover:text-on-surface aria-pressed:border-secondary aria-pressed:bg-secondary/10 aria-pressed:text-on-surface"
            >
              {s.title[locale]}
            </button>
          ))}
        </div>
      ) : null}

      {placeholder ? (
        <p className="rounded-lg border border-error/60 bg-error-container/30 px-3 py-2 text-body-md text-on-error-container">
          {variant === "placeholder" ? t("placeholder.note") : t("placeholder.noteFacts")}
        </p>
      ) : null}

      <section aria-labelledby={inputHeadingId} className="flex flex-col gap-2">
        <h3 id={inputHeadingId} className="font-mono text-label-mono-sm tracking-wider text-outline uppercase">
          {t("inputTitle")}
        </h3>
        {sample.input.kind === "images" ? (
          <ImageGrid items={sample.input.items} locale={locale} placeholder={placeholder} ribbon={ribbon} />
        ) : sample.input.kind === "question" ? (
          <p
            data-role="user"
            lang={sample.input.lang}
            className="max-w-[82%] self-end rounded-xl bg-surface-container-high px-3.5 py-2.5 text-body-md break-words text-on-surface"
          >
            <span className="sr-only">{t("chat.you")}: </span>
            {sample.input.text[locale]}
          </p>
        ) : (
          <figure className="m-0 flex flex-col gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest p-4">
            <figcaption className="flex flex-wrap items-center gap-2">
              <svg
                aria-hidden="true"
                focusable={false}
                viewBox="0 0 16 16"
                className="size-4 shrink-0 text-secondary"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinejoin="round"
              >
                <path d="M4 1.5h5.5L12.5 4.5v10h-8.5z" />
                <path d="M9.5 1.5v3h3M6 8h4.5M6 10.5h4.5" />
              </svg>
              <span className="font-mono text-code-inline text-on-surface">{sample.input.fileName}</span>
              <span className="text-code-block text-on-surface-variant">{t("fileCardLabel")}</span>
            </figcaption>
            <div className="flex flex-col gap-1 border-l-2 border-outline-variant pl-3">
              {sample.input.excerpt[locale].map((line) => (
                <p key={line} className="text-body-md text-on-surface">
                  {line}
                </p>
              ))}
            </div>
          </figure>
        )}
      </section>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3 font-mono text-label-mono-sm tracking-wider text-outline uppercase">
            <span>{t("flowTitle")}</span>
            <span role="status" className="font-medium text-secondary">
              {t(`runStatus.${status}`)}
            </span>
          </div>
          <button
            type="button"
            onClick={play}
            aria-disabled={status === "playing" ? true : undefined}
            className="rounded-lg bg-primary-container px-4 py-2 text-body-md font-semibold text-on-primary-container aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
          >
            {status === "done" ? t("replay") : t("play")}
          </button>
        </div>
        <FlowPlayer state={flow} label={t("flowLabel")} statusLabels={statusLabels} dataLabels={dataLabels} />
      </div>

      <section aria-labelledby={resultHeadingId} className="flex flex-col gap-2">
        <h3 id={resultHeadingId} className="font-mono text-label-mono-sm tracking-wider text-outline uppercase">
          {t("resultTitle")}
        </h3>
        {!showResult ? (
          <p className="text-body-md text-on-surface-variant">{t("resultHint")}</p>
        ) : sample.result.kind === "images" ? (
          <ImageGrid items={sample.result.items} locale={locale} placeholder={placeholder} ribbon={ribbon} />
        ) : sample.result.kind === "text" ? (
          <div
            data-role="bot"
            lang={sample.result.lang}
            className="w-full max-w-[92%] self-start rounded-xl border border-primary-container/50 bg-primary-container/20 px-3.5 py-2.5 text-body-md text-on-surface sm:max-w-[82%]"
          >
            <span className="sr-only">{t("chat.bot")}: </span>
            <Markdown>{sample.result.text[locale]}</Markdown>
          </div>
        ) : (
          <PeopleResult people={sample.result.people} />
        )}
      </section>

      {footnote ? <div className="text-body-md text-on-surface-variant">{footnote}</div> : null}
    </div>
  );
}
