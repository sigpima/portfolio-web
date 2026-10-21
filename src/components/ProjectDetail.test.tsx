import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi as vitest } from "vitest";
import { InviteSessionProvider } from "@/lib/invite/use-invite-session";
import type { DemoKind, Locale, Project } from "@/content/types";
import viMessages from "../../messages/vi.json";
import enMessages from "../../messages/en.json";
import { ProjectDetail } from "./ProjectDetail";

vitest.mock("@/components/demos/registry", () => ({
  demoComponents: {
    stub: ({ locale }: { locale: string }) => <div data-testid="demo-stub">stub demo {locale}</div>,
  },
}));

const LABELS: Record<Locale, Record<Exclude<DemoKind, "none">, string>> = {
  vi: {
    live: "Chạy thật",
    replay: "Phát lại từ lần chạy thật",
    simulation: "Mô phỏng · tính năng đang phát triển",
  },
  en: {
    live: "Live",
    replay: "Replay of a real run",
    simulation: "Simulation · feature in development",
  },
};

function fakeProject(demoKind: DemoKind): Project {
  const l = (s: string) => ({ vi: `${s} (vi)`, en: `${s} (en)` });
  return {
    slug: `fake-${demoKind}`,
    group: "ai-agent",
    demoKind,
    featured: false,
    order: 1,
    title: l("Fake title"),
    tagline: l("Fake tagline"),
    summary: l("Fake summary"),
    problem: l("Fake problem"),
    approach: l("Fake approach"),
    highlights: { vi: ["Điểm 1 (vi)", "Điểm 2 (vi)"], en: ["Point 1 (en)", "Point 2 (en)"] },
    tech: ["Python", "MCP"],
    links: [{ label: l("Repo"), href: "https://example.com/repo" }],
    cover: "/projects/knowledge-base.svg",
    demo: demoKind === "none" ? undefined : { component: "stub" },
  };
}

function renderDetail(project: Project, locale: Locale) {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "vi" ? viMessages : enMessages}>
      <InviteSessionProvider>
        <ProjectDetail project={project} locale={locale} />
      </InviteSessionProvider>
    </NextIntlClientProvider>,
  );
}

// An invited visitor with the chat feature: the in-demo badge of a live project says "live".
beforeEach(() => {
  vitest.stubGlobal(
    "fetch",
    vitest.fn(async () => Response.json({ invited: true, features: { chat: true, twistfit: false, gia_pha: false } })),
  );
});

afterEach(() => {
  vitest.unstubAllGlobals();
});

describe("ProjectDetail", () => {
  for (const locale of ["vi", "en"] as const) {
    for (const kind of ["live", "replay", "simulation"] as const) {
      it(`shows the ${kind} badge right above the demo in ${locale}`, async () => {
        renderDetail(fakeProject(kind), locale);
        await screen.findAllByText(LABELS[locale][kind], { exact: true });
        const demo = screen.getByTestId("demo-stub");
        expect(demo).toHaveTextContent(`stub demo ${locale}`);
        // the badge sits in the same demo region, once, and precedes the demo
        const region = demo.closest("section");
        expect(region).not.toBeNull();
        const inRegion = within(region as HTMLElement).getAllByText(LABELS[locale][kind], { exact: true });
        expect(inRegion).toHaveLength(1);
        expect(inRegion[0].compareDocumentPosition(demo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        const badge = (region as HTMLElement).querySelector(`[data-demo-kind='${kind}']`);
        expect(badge).not.toBeNull();
      });
    }

    it(`shows no badge and no demo for demoKind none in ${locale}`, () => {
      renderDetail(fakeProject("none"), locale);
      for (const label of Object.values(LABELS[locale])) {
        expect(screen.queryByText(label, { exact: true })).toBeNull();
      }
      expect(screen.queryByTestId("demo-stub")).toBeNull();
    });

    it(`renders the narrative in ${locale}`, () => {
      renderDetail(fakeProject("none"), locale);
      expect(screen.getByRole("heading", { level: 1, name: `Fake title (${locale})` })).toBeInTheDocument();
      expect(screen.getByText(`Fake tagline (${locale})`)).toBeInTheDocument();
      expect(screen.getByText(`Fake summary (${locale})`)).toBeInTheDocument();
      expect(screen.getByText(`Fake problem (${locale})`)).toBeInTheDocument();
      expect(screen.getByText(`Fake approach (${locale})`)).toBeInTheDocument();
      expect(screen.getByText(locale === "vi" ? "Điểm 1 (vi)" : "Point 1 (en)")).toBeInTheDocument();
      expect(screen.getAllByText("Python").length).toBeGreaterThan(0);
      expect(screen.getByRole("link", { name: `Repo (${locale})` })).toHaveAttribute(
        "href",
        "https://example.com/repo",
      );
    });
  }
});
