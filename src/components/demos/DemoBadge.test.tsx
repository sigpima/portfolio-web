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

function renderBadge(kind: "live" | "replay" | "simulation", locale: Locale) {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "vi" ? viMessages : enMessages}>
      <DemoBadge kind={kind} locale={locale} />
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
});
