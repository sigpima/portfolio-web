import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listProjects } from "@/content/registry";
import type { Locale, Project } from "@/content/types";
import { InviteSessionProvider } from "@/lib/invite/use-invite-session";
import viMessages from "../../messages/vi.json";
import enMessages from "../../messages/en.json";
import { HomeProjectSections } from "./HomeProjects";
import { ProjectCard } from "./ProjectCard";
import { ProjectDetail } from "./ProjectDetail";

/*
 * Every surface that labels a project by its demo kind, given each live project, for a
 * visitor WITHOUT an invite: the static label is "live · invite only", "Chạy thật"/"Live"
 * never appears on its own, and no placeholder chip sits next to the live label (the
 * replay fallback is qualified only inside the demo area).
 */
const live = listProjects().filter((p) => p.demoKind === "live");
const MESSAGES = { vi: viMessages, en: enMessages };
const BARE: Record<Locale, RegExp> = {
  vi: /Chạy thật(?! · cần link mời)/,
  en: /\bLive\b(?! · invite only)/,
};

const surfaces: { name: string; render: (p: Project, l: Locale) => ReactElement }[] = [
  { name: "home featured card", render: (p, l) => <HomeProjectSections projects={[{ ...p, featured: true }]} locale={l} /> },
  { name: "home other card", render: (p, l) => <HomeProjectSections projects={[{ ...p, featured: false }]} locale={l} /> },
  { name: "project list card", render: (p, l) => <ProjectCard project={p} locale={l} /> },
  { name: "project detail page", render: (p, l) => <ProjectDetail project={p} locale={l} /> },
];

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/session") {
        return Response.json({ invited: false, features: { chat: false, twistfit: false, gia_pha: false } });
      }
      throw new Error(`unexpected fetch ${String(input)}`);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("live projects are labelled invite-only on every surface", () => {
  it("has at least one live project to check", () => {
    expect(live.map((p) => p.slug)).toEqual(expect.arrayContaining(["knowledge-base", "twistfit"]));
  });

  for (const project of live) {
    for (const surface of surfaces) {
      for (const locale of ["vi", "en"] as const) {
        it(`${project.slug} · ${surface.name} · ${locale}`, async () => {
          const m = MESSAGES[locale];
          const { container } = render(
            <NextIntlClientProvider locale={locale} messages={m}>
              <InviteSessionProvider>{surface.render(project, locale)}</InviteSessionProvider>
            </NextIntlClientProvider>,
          );
          // Let the session settle (the detail page then shows the replay).
          if (surface.name === "project detail page") {
            await screen.findByText(project.slug === "twistfit" ? m.twistfit.replayNotice : m.kb.replayNotice);
          }
          expect(container.textContent).toContain(m.demo.badge.liveInvite.label);
          expect(container.textContent).not.toMatch(BARE[locale]);
          // Outside the demo area, no placeholder chip next to the live label.
          const outside = container.cloneNode(true) as HTMLElement;
          outside.querySelector("#demo")?.remove();
          expect(outside.textContent).not.toContain(m.demo.badgeQualifier.placeholder.chip);
          expect(outside.textContent).not.toContain(m.demo.badgeQualifier.placeholderFacts.chip);
          // The KB samples have no images: no surface may speak of placeholder images.
          if (project.slug === "knowledge-base") {
            expect(container.textContent).not.toMatch(/Ảnh và dữ kiện|images and facts|ảnh giữ chỗ|placeholder images/i);
          }
        });
      }
    }
  }
});
