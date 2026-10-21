import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi as vitest } from "vitest";
import type { Locale } from "@/content/types";
import { getProject } from "@/content/registry";
import { twistfitReplay } from "@/content/replays/twistfit";
import viMessages from "../../messages/vi.json";
import enMessages from "../../messages/en.json";
import { ProjectCard } from "./ProjectCard";
import { ProjectDetail } from "./ProjectDetail";

vitest.mock("@/components/demos/registry", () => ({
  demoComponents: { "twistfit-replay": () => <div data-testid="demo-stub" /> },
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
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("Twistfit placeholder state follows the replay data", () => {
  for (const locale of ["vi", "en"] as const) {
    it(`placeholder samples: detail eyebrow, facts and badge are qualified (${locale})`, () => {
      const project = getProject("twistfit")!;
      const { container } = wrap(locale, <ProjectDetail project={project} locale={locale} />);
      // eyebrow + facts strip + demo badge each carry the chip
      expect(screen.getAllByText(CHIP[locale], { exact: false }).length).toBeGreaterThanOrEqual(3);
      const badge = container.querySelector("[data-demo-kind='replay']");
      expect(badge).toHaveTextContent(LABEL[locale]);
      expect(badge).toHaveTextContent(PLACEHOLDER_DESC[locale]);
      expect(badge).not.toHaveTextContent(DEFAULT_DESC[locale]);
    });

    it(`real samples: no qualifier anywhere, default description (${locale})`, () => {
      const saved = twistfitReplay.samples.map((s) => s.placeholder);
      twistfitReplay.samples.forEach((s) => (s.placeholder = false));
      try {
        const project = getProject("twistfit")!;
        const { container } = wrap(
          locale,
          <>
            <ProjectCard project={project} locale={locale} />
            <ProjectDetail project={project} locale={locale} />
          </>,
        );
        expect(screen.queryByText(CHIP[locale], { exact: false })).toBeNull();
        const badge = container.querySelector("[data-demo-kind='replay']");
        expect(badge).toHaveTextContent(LABEL[locale]);
        expect(badge).toHaveTextContent(DEFAULT_DESC[locale]);
      } finally {
        twistfitReplay.samples.forEach((s, i) => (s.placeholder = saved[i]));
      }
    });
  }
});
