import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import type { Locale } from "@/content/types";
import viMessages from "../../../messages/vi.json";
import enMessages from "../../../messages/en.json";
import { DemoBadge } from "./DemoBadge";

const LABELS = {
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
} as const;

const QUALIFIER = {
  vi: { chip: "Ảnh và dữ kiện giữ chỗ", description: "Mẫu giữ chỗ: chưa có bản ghi của lần chạy thật nào được gắn vào." },
  en: { chip: "Placeholder images and facts", description: "Placeholder sample: no record of a real run is attached yet." },
} as const;

function renderBadge(kind: "live" | "replay" | "simulation", locale: Locale, qualifier?: "placeholder") {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "vi" ? viMessages : enMessages}>
      <DemoBadge kind={kind} locale={locale} qualifier={qualifier} />
    </NextIntlClientProvider>,
  );
}

describe("DemoBadge", () => {
  for (const locale of ["vi", "en"] as const) {
    for (const kind of ["live", "replay", "simulation"] as const) {
      it(`shows the exact ${kind} label and a description in ${locale}`, () => {
        const { container } = renderBadge(kind, locale);
        const label = screen.getByText(LABELS[locale][kind], { exact: true });
        expect(label).toBeVisible();
        const description = container.querySelector("[data-role='badge-description']");
        expect(description?.textContent?.length ?? 0).toBeGreaterThan(20);
        expect(container.querySelector("[role='status']")).toBeNull();
      });
    }
  }

  for (const locale of ["vi", "en"] as const) {
    it(`qualifies a placeholder replay with a chip and a placeholder description in ${locale}`, () => {
      const { container } = renderBadge("replay", locale, "placeholder");
      expect(screen.getByText(LABELS[locale].replay, { exact: true })).toBeVisible();
      expect(screen.getByText(QUALIFIER[locale].chip, { exact: true })).toBeVisible();
      const description = container.querySelector("[data-role='badge-description']");
      expect(description).toHaveTextContent(QUALIFIER[locale].description);
    });

    it(`shows no qualifier without the prop in ${locale}`, () => {
      for (const kind of ["live", "replay", "simulation"] as const) {
        const { unmount } = renderBadge(kind, locale);
        expect(screen.queryByText(QUALIFIER[locale].chip)).toBeNull();
        expect(screen.queryByText(QUALIFIER[locale].description)).toBeNull();
        unmount();
      }
    });
  }
});
