import { render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { twistfitLive } from "@/test-utils/twistfit-live";
import type { Locale } from "@/content/types";
import { InviteSessionProvider } from "@/lib/invite/use-invite-session";
import viMessages from "../../messages/vi.json";
import enMessages from "../../messages/en.json";
import { ProjectDetail } from "./ProjectDetail";

const twistfit = twistfitLive;
const OFF = { chat: false, twistfit: false, gia_pha: false };
const CHAT_ONLY = { chat: true, twistfit: false, gia_pha: false };
const ON = { chat: false, twistfit: true, gia_pha: false };
const CATALOG = {
  max_items: 3,
  models: [{ id: "m1", name: { vi: "Lan", en: "Lan" } }],
  items: [{ id: "ao", name: { vi: "Áo sơ mi", en: "Shirt" } }],
};

function stubSession(session: { invited: boolean; features: typeof ON } | "pending") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/session") {
        return session === "pending" ? new Promise<Response>(() => {}) : Response.json(session);
      }
      if (url === "/api/twistfit/catalog") return Response.json(CATALOG);
      throw new Error(`unexpected fetch ${url}`);
    }),
  );
}

function renderTwistfit(locale: Locale) {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "vi" ? viMessages : enMessages}>
      <InviteSessionProvider>
        <ProjectDetail project={twistfit} locale={locale} />
      </InviteSessionProvider>
    </NextIntlClientProvider>,
  );
}

const demoRegion = () => document.getElementById("demo") as HTMLElement;

/** "Chạy thật" / "Live" on its own, i.e. not as part of the invite-only label. */
const BARE_LIVE: Record<Locale, RegExp> = {
  vi: /Chạy thật(?! · cần link mời)/,
  en: /\bLive\b(?! · invite only)/,
};

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ProjectDetail for Twistfit (live for invited visitors, replay otherwise)", () => {
  for (const locale of ["vi", "en"] as const) {
    const m = locale === "vi" ? viMessages : enMessages;

    it(`labels the eyebrow and facts strip as live-invite-only (${locale})`, async () => {
      stubSession({ invited: false, features: OFF });
      const { container } = renderTwistfit(locale);
      expect(container.querySelector("header p span")).toHaveTextContent(m.demo.badge.liveInvite.label);
      expect(container.querySelector("dl")).toHaveTextContent(m.demo.badge.liveInvite.label);
      await screen.findByText(m.twistfit.replayNotice);
    });

    it(`without an invite, the in-demo badge is the qualified replay badge and "live" never appears alone (${locale})`, async () => {
      stubSession({ invited: false, features: OFF });
      renderTwistfit(locale);
      await screen.findByText(m.twistfit.replayNotice);
      const badges = demoRegion().querySelectorAll("[data-demo-kind]");
      expect(badges).toHaveLength(1);
      expect(badges[0]).toHaveAttribute("data-demo-kind", "replay");
      expect(badges[0]).toHaveAttribute("data-qualifier", "placeholder");
      expect(document.body.textContent).not.toMatch(BARE_LIVE[locale]);
    });

    it(`an invite with chat only still gets the replay badge for Twistfit (${locale})`, async () => {
      stubSession({ invited: true, features: CHAT_ONLY });
      renderTwistfit(locale);
      await screen.findByText(m.twistfit.replayNoticeNoTwistfit);
      expect(demoRegion().querySelector("[data-demo-kind]")).toHaveAttribute("data-demo-kind", "replay");
    });

    it(`with an invite that includes twistfit, the in-demo badge says live (${locale})`, async () => {
      stubSession({ invited: true, features: ON });
      renderTwistfit(locale);
      await waitFor(() =>
        expect(demoRegion().querySelector("[data-demo-kind]")).toHaveAttribute("data-demo-kind", "live"),
      );
      expect(demoRegion().querySelector("[data-demo-kind]")).not.toHaveAttribute("data-qualifier");
      expect(demoRegion()).toHaveTextContent(m.demo.badge.live.label);
      expect(await screen.findByText(m.twistfit.live.steps.items)).toBeInTheDocument();
    });
  }

  it("shows no in-demo badge until the session is known", () => {
    stubSession("pending");
    renderTwistfit("vi");
    expect(demoRegion().querySelector("[data-demo-kind]")).toBeNull();
    expect(document.body.textContent).not.toMatch(BARE_LIVE.vi);
  });
});
