import { render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Locale } from "@/content/types";
import { InviteSessionProvider } from "@/lib/invite/use-invite-session";
import viMessages from "../../../messages/vi.json";
import enMessages from "../../../messages/en.json";
import { TwistfitSwitch } from "./TwistfitSwitch";

const ON = { chat: false, twistfit: true, gia_pha: false };
const OFF = { chat: false, twistfit: false, gia_pha: false };

const CATALOG = {
  max_items: 3,
  models: [{ id: "m1", name: { vi: "Lan", en: "Lan" } }],
  items: [{ id: "ao", name: { vi: "Áo sơ mi", en: "Shirt" } }],
};

type Session = { invited: boolean; features: typeof ON } | "pending";

function stubFetch(session: Session, catalog: () => Response = () => Response.json(CATALOG)) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "/api/session") {
      if (session === "pending") return new Promise<Response>(() => {});
      return Response.json(session);
    }
    if (url === "/api/twistfit/catalog") return catalog();
    throw new Error(`unexpected fetch ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function twistfitCalls(fetchMock: ReturnType<typeof stubFetch>) {
  return fetchMock.mock.calls.filter(([url]) => String(url).startsWith("/api/twistfit/"));
}

function renderSwitch(locale: Locale = "vi") {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "vi" ? viMessages : enMessages}>
      <InviteSessionProvider>
        <TwistfitSwitch locale={locale} />
      </InviteSessionProvider>
    </NextIntlClientProvider>,
  );
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

describe("TwistfitSwitch", () => {
  for (const locale of ["vi", "en"] as const) {
    const m = locale === "vi" ? viMessages : enMessages;

    it(`without an invite, shows the replay and its notice and never calls /api/twistfit (${locale})`, async () => {
      const fetchMock = stubFetch({ invited: false, features: OFF });
      const { container } = renderSwitch(locale);
      expect(await screen.findByText(m.twistfit.replayNotice)).toBeInTheDocument();
      expect(screen.queryByText(m.twistfit.replayNoticeNoTwistfit)).toBeNull();
      expect(container.querySelector('[data-twistfit-mode="replay"]')).not.toBeNull();
      expect(screen.getByText(m.demo.badge.replay.label)).toBeInTheDocument();
      expect(screen.queryByText(m.demo.badge.live.label, { exact: true })).toBeNull();
      // The replay's placeholder samples keep their qualifier.
      expect(screen.getAllByText(m.demo.placeholder.ribbon).length).toBeGreaterThan(0);
      expect(twistfitCalls(fetchMock)).toEqual([]);
    });

    it(`an invited visitor without the twistfit feature gets the replay with its own notice (${locale})`, async () => {
      const fetchMock = stubFetch({ invited: true, features: { ...OFF, chat: true } });
      renderSwitch(locale);
      expect(await screen.findByText(m.twistfit.replayNoticeNoTwistfit)).toBeInTheDocument();
      expect(screen.queryByText(m.twistfit.replayNotice)).toBeNull();
      expect(twistfitCalls(fetchMock)).toEqual([]);
    });
  }

  it("with an invite that includes twistfit, shows the live demo (and only then loads the catalog)", async () => {
    const fetchMock = stubFetch({ invited: true, features: ON });
    const { container } = renderSwitch();
    expect(await screen.findByText(viMessages.twistfit.live.steps.items)).toBeInTheDocument();
    expect(container.querySelector('[data-twistfit-mode]')).toBeNull();
    expect(screen.queryByText(viMessages.twistfit.replayNotice)).toBeNull();
    expect(screen.queryByText(viMessages.demo.badge.replay.label)).toBeNull();
    await waitFor(() => expect(twistfitCalls(fetchMock).map(([url]) => url)).toEqual(["/api/twistfit/catalog"]));
  });

  it("while the session is unknown, shows a neutral waiting block and neither demo", () => {
    const fetchMock = stubFetch("pending");
    const { container } = renderSwitch();
    const block = container.querySelector('[data-twistfit-mode="pending"]');
    expect(block).not.toBeNull();
    expect(block).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText(viMessages.twistfit.modeLoading)).toBeInTheDocument();
    expect(screen.queryByText(viMessages.twistfit.replayNotice)).toBeNull();
    expect(screen.queryByText(viMessages.demo.badge.replay.label)).toBeNull();
    expect(screen.queryByText(viMessages.twistfit.live.steps.items)).toBeNull();
    expect(twistfitCalls(fetchMock)).toEqual([]);
  });

  it("falls back to the replay, without a reload, when the catalog finds the invite revoked", async () => {
    const fetchMock = stubFetch({ invited: true, features: ON }, () =>
      Response.json({ code: "invite_required" }, { status: 401 }),
    );
    const { container } = renderSwitch();
    const lost = await screen.findByText(viMessages.twistfit.live.errors.inviteRequired);
    // Only the "no longer valid" message: no "open an invite link" sentence on top of it.
    expect(screen.queryByText(viMessages.twistfit.replayNotice)).toBeNull();
    expect(screen.queryByText(viMessages.twistfit.replayNoticeNoTwistfit)).toBeNull();
    expect(container.querySelector('[data-twistfit-mode="replay"]')).not.toBeNull();
    expect(screen.getByText(viMessages.demo.badge.replay.label)).toBeInTheDocument();
    // The live demo's step list is gone (the replay's own text may reuse the step names).
    expect(screen.queryByText(/Chọn từ 1 đến 3 món đồ/)).toBeNull();
    expect(screen.queryByRole("button", { name: viMessages.twistfit.live.next })).toBeNull();
    await waitFor(() => expect(lost.closest("[tabindex='-1']")).toHaveFocus());
    expect(twistfitCalls(fetchMock)).toHaveLength(1);
  });
});
