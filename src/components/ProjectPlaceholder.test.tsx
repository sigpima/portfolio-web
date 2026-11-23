import { render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi as vitest } from "vitest";
import type { Locale } from "@/content/types";
import { twistfitLive } from "@/test-utils/twistfit-live";
import { twistfitReplay } from "@/content/replays/twistfit";
import { InviteSessionProvider } from "@/lib/invite/use-invite-session";
import viMessages from "../../messages/vi.json";
import enMessages from "../../messages/en.json";
import { ProjectCard } from "./ProjectCard";
import { ProjectDetail } from "./ProjectDetail";

vitest.mock("@/components/demos/registry", () => ({
  demoComponents: { twistfit: () => <div data-testid="demo-stub" /> },
}));

const CHIP = { vi: "Ảnh và dữ kiện giữ chỗ", en: "Placeholder images and facts" } as const;
const LABEL = { vi: "Phát lại từ lần chạy thật", en: "Replay of a real run" } as const;
const PLACEHOLDER_DESC = {
  vi: "Mẫu giữ chỗ: chưa có bản ghi của lần chạy thật nào được gắn vào.",
  en: "Placeholder sample: no record of a real run is attached yet.",
} as const;
const DEFAULT_DESC = {
  vi: "Các bước được phát lại theo bản ghi của một lần chạy; không có dịch vụ nào được gọi khi bạn xem.",
  en: "The steps are played back from the record of a run; no service is called while you watch.",
} as const;

function wrap(locale: Locale, ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "vi" ? viMessages : enMessages}>
      <InviteSessionProvider>{ui}</InviteSessionProvider>
    </NextIntlClientProvider>,
  );
}

// A visitor without an invite: Twistfit is live only with a link, so they get the replay variant.
beforeEach(() => {
  vitest.stubGlobal(
    "fetch",
    vitest.fn(async () => Response.json({ invited: false, features: { chat: false, twistfit: false, gia_pha: false } })),
  );
});

afterEach(() => {
  vitest.unstubAllGlobals();
});

describe("Twistfit placeholder state follows the replay data (not-invited view)", () => {
  for (const locale of ["vi", "en"] as const) {
    it(`placeholder samples: only the in-demo replay badge is qualified; eyebrow and facts say live-invite (${locale})`, async () => {
      const project = twistfitLive;
      const { container } = wrap(locale, <ProjectDetail project={project} locale={locale} />);
      const m = locale === "vi" ? viMessages : enMessages;
      const badge = await findReplayBadge(container);
      expect(badge).toHaveTextContent(LABEL[locale]);
      expect(badge).toHaveTextContent(CHIP[locale]);
      expect(badge).toHaveTextContent(PLACEHOLDER_DESC[locale]);
      expect(badge).not.toHaveTextContent(DEFAULT_DESC[locale]);
      // Outside the demo area the static label is the invite-only one, with no placeholder chip.
      expect(container.querySelector("header p span")).toHaveTextContent(m.demo.badge.liveInvite.label);
      expect(container.querySelector("dl")).toHaveTextContent(m.demo.badge.liveInvite.label);
      expect(container.querySelector("header")).not.toHaveTextContent(CHIP[locale]);
      expect(container.querySelector("dl")).not.toHaveTextContent(CHIP[locale]);
    });

    it(`real samples: no qualifier anywhere, default description (${locale})`, async () => {
      const saved = twistfitReplay.samples.map((s) => s.placeholder);
      twistfitReplay.samples.forEach((s) => (s.placeholder = false));
      try {
        const project = twistfitLive;
        const { container } = wrap(
          locale,
          <>
            <ProjectCard project={project} locale={locale} />
            <ProjectDetail project={project} locale={locale} />
          </>,
        );
        const badge = await findReplayBadge(container);
        expect(screen.queryByText(CHIP[locale], { exact: false })).toBeNull();
        expect(badge).toHaveTextContent(LABEL[locale]);
        expect(badge).toHaveTextContent(DEFAULT_DESC[locale]);
      } finally {
        twistfitReplay.samples.forEach((s, i) => (s.placeholder = saved[i]));
      }
    });
  }
});

/** The in-demo replay badge, once the invite session has settled (no invite). */
async function findReplayBadge(container: HTMLElement) {
  await screen.findByTestId("demo-stub");
  await waitFor(() => expect(container.querySelector("[data-demo-kind='replay']")).not.toBeNull());
  return container.querySelector("[data-demo-kind='replay']") as HTMLElement;
}
