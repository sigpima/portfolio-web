import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { getProject } from "@/content/registry";
import type { Locale } from "@/content/types";
import viMessages from "../../messages/vi.json";
import enMessages from "../../messages/en.json";
import { HomeProjectSections } from "./HomeProjects";
import { ProjectCard } from "./ProjectCard";
import { ProjectDetail } from "./ProjectDetail";

const SOON: Record<Locale, string> = { vi: "Demo sắp có", en: "Demo coming soon" };
const VISIT: Record<Locale, string> = { vi: "Truy cập website", en: "Visit the website" };
const gia = getProject("gia-pha")!;
const twistfit = getProject("twistfit")!;

function wrap(locale: Locale, ui: ReactElement) {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "vi" ? viMessages : enMessages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("projects whose demo is coming soon", () => {
  for (const locale of ["vi", "en"] as const) {
    it(`card says coming soon and shows no live, replay or simulation label (${locale})`, () => {
      wrap(locale, <ProjectCard project={gia} locale={locale} />);
      expect(screen.getByText(SOON[locale])).toBeInTheDocument();
      expect(screen.queryByText(/Chạy thật|Live|Phát lại|Replay|Mô phỏng|Simulation/)).toBeNull();
    });

    it(`detail page links Gia phả to its website, opening safely in a new tab (${locale})`, () => {
      const { container } = wrap(locale, <ProjectDetail project={gia} locale={locale} />);
      const links = screen.getAllByRole("link", { name: new RegExp(VISIT[locale]) });
      expect(links.length).toBeGreaterThan(0);
      for (const link of links) {
        expect(link).toHaveAttribute("href", "https://genealogy.sigpima.space");
        expect(link).toHaveAttribute("target", "_blank");
        expect(link.getAttribute("rel")).toMatch(/noopener/);
      }
      expect(container.querySelector("#demo")).toHaveTextContent(SOON[locale]);
      expect(container.querySelector("header")).toHaveTextContent(SOON[locale]);
      expect(container.querySelector("dl")).toHaveTextContent(SOON[locale]);
      // No demo widget and no demo badge.
      expect(container.querySelector("[data-testid], [role='tablist']")).toBeNull();
      expect(container).not.toHaveTextContent(/Mô phỏng|Simulation/);
    });

    it(`detail page links Twistfit to twistfit.org (${locale})`, () => {
      wrap(locale, <ProjectDetail project={twistfit} locale={locale} />);
      for (const link of screen.getAllByRole("link", { name: new RegExp(VISIT[locale]) })) {
        expect(link).toHaveAttribute("href", "https://twistfit.org");
      }
    });

    it(`detail page without a website yet says it is coming soon and has no outbound link (${locale})`, () => {
      const { container } = wrap(locale, <ProjectDetail project={{ ...twistfit, website: undefined }} locale={locale} />);
      expect(container.querySelector("#demo")).toHaveTextContent(SOON[locale]);
      expect(screen.queryByRole("link", { name: new RegExp(VISIT[locale]) })).toBeNull();
      expect(container.querySelector("a[target='_blank']")).toBeNull();
    });

    it(`home featured card offers the website instead of a demo button (${locale})`, () => {
      wrap(locale, <HomeProjectSections projects={[{ ...gia, featured: true }]} locale={locale} />);
      expect(screen.getByText(SOON[locale])).toBeInTheDocument();
      expect(screen.getByRole("link", { name: new RegExp(VISIT[locale]) })).toHaveAttribute(
        "href",
        "https://genealogy.sigpima.space",
      );
      expect(document.querySelector('a[href$="#demo"]')).toBeNull();
    });
  }
});
