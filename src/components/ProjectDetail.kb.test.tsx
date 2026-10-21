import { render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getProject } from "@/content/registry";
import { isPlaceholderDemo } from "@/content/replays";
import type { Locale } from "@/content/types";
import { InviteSessionProvider } from "@/lib/invite/use-invite-session";
import viMessages from "../../messages/vi.json";
import enMessages from "../../messages/en.json";
import { ProjectDetail } from "./ProjectDetail";

const kb = getProject("knowledge-base")!;
const OFF = { chat: false, twistfit: false, gia_pha: false };
const ON = { chat: true, twistfit: false, gia_pha: false };

/** "Chạy thật" / "Live" on its own, i.e. not as part of the invite-only label. */
const BARE_LIVE: Record<Locale, RegExp> = {
  vi: /Chạy thật(?! · cần link mời)/,
  en: /\bLive\b(?! · invite only)/,
};

function stubSession(session: { invited: boolean; features: typeof ON } | "pending") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/session") {
        return session === "pending" ? new Promise<Response>(() => {}) : Response.json(session);
      }
      if (url === "/api/chat/status") return Response.json({ enabled: true });
      throw new Error(`unexpected fetch ${url}`);
    }),
  );
}

function renderKb(locale: Locale) {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "vi" ? viMessages : enMessages}>
      <InviteSessionProvider>
        <ProjectDetail project={kb} locale={locale} />
      </InviteSessionProvider>
    </NextIntlClientProvider>,
  );
}

function demoRegion() {
  return document.getElementById("demo") as HTMLElement;
}

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

describe("ProjectDetail for the Knowledge Base (live, invite only)", () => {
  for (const locale of ["vi", "en"] as const) {
    const m = locale === "vi" ? viMessages : enMessages;

    it(`labels the eyebrow and facts strip as live-invite-only (${locale})`, async () => {
      stubSession({ invited: false, features: OFF });
      const { container } = renderKb(locale);
      const eyebrow = container.querySelector("header p span");
      expect(eyebrow).toHaveTextContent(m.demo.badge.liveInvite.label);
      const facts = container.querySelector("dl");
      expect(facts).toHaveTextContent(m.demo.badge.liveInvite.label);
      await screen.findByText(m.kb.replayNotice);
    });

    it(`without an invite, the in-demo badge is a replay badge and "live" never appears alone (${locale})`, async () => {
      stubSession({ invited: false, features: OFF });
      renderKb(locale);
      await screen.findByText(m.kb.replayNotice);
      const badges = demoRegion().querySelectorAll("[data-demo-kind]");
      expect(badges).toHaveLength(1);
      expect(badges[0]).toHaveAttribute("data-demo-kind", "replay");
      if (isPlaceholderDemo(kb)) expect(badges[0]).toHaveAttribute("data-qualifier", "placeholder");
      else expect(badges[0]).not.toHaveAttribute("data-qualifier");
      expect(document.body.textContent).not.toMatch(BARE_LIVE[locale]);
    });

    it(`with an invite that includes chat, the in-demo badge says live (${locale})`, async () => {
      stubSession({ invited: true, features: ON });
      renderKb(locale);
      await waitFor(() =>
        expect(demoRegion().querySelector("[data-demo-kind]")).toHaveAttribute("data-demo-kind", "live"),
      );
      expect(demoRegion().querySelector("[data-demo-kind]")).not.toHaveAttribute("data-qualifier");
      expect(demoRegion()).toHaveTextContent(m.demo.badge.live.label);
    });
  }

  it("shows no in-demo badge until the session is known (no flash of a wrong label)", () => {
    stubSession("pending");
    renderKb("vi");
    expect(demoRegion().querySelector("[data-demo-kind]")).toBeNull();
    expect(document.body.textContent).not.toMatch(BARE_LIVE.vi);
  });
});
