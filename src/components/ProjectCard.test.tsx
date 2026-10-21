import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import type { Locale } from "@/content/types";
import { getProject } from "@/content/registry";
import viMessages from "../../messages/vi.json";
import enMessages from "../../messages/en.json";
import { ProjectCard } from "./ProjectCard";

function renderCard(slug: string, locale: Locale) {
  const project = getProject(slug)!;
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "vi" ? viMessages : enMessages}>
      <ProjectCard project={project} locale={locale} />
    </NextIntlClientProvider>,
  );
}

describe("ProjectCard", () => {
  it("shows the Vietnamese title and links to /vi/projects/{slug}", () => {
    renderCard("knowledge-base", "vi");
    const link = screen.getByRole("link", { name: /Knowledge Base: hỏi đáp báo giá thi công sơn/ });
    expect(link).toHaveAttribute("href", "/vi/projects/knowledge-base");
    expect(screen.queryByText("Knowledge Base: paint-contracting quotation Q&A")).toBeNull();
    expect(screen.getByText("AI / LLM / Agent")).toBeInTheDocument();
    expect(screen.getByText("Chạy thật · cần link mời")).toBeInTheDocument();
    expect(screen.queryByText("Chạy thật", { exact: true })).toBeNull();
  });

  it("labels the live Knowledge Base card as invite only in English", () => {
    renderCard("knowledge-base", "en");
    expect(screen.getByText("Live · invite only")).toBeInTheDocument();
    expect(screen.queryByText("Live", { exact: true })).toBeNull();
  });

  it("shows the English title, group and demo label", () => {
    renderCard("twistfit", "en");
    const link = screen.getByRole("link", { name: /Twistfit: outfit matching by personal colour/ });
    expect(link).toHaveAttribute("href", "/en/projects/twistfit");
    expect(screen.getByText("Website")).toBeInTheDocument();
    expect(screen.getByText("Replay of a real run")).toBeInTheDocument();
    expect(
      screen.getByText("A fashion website that suggests outfits from your wardrobe and renders a try-on image with Flux."),
    ).toBeInTheDocument();
  });

  it("uses a heading for the title", () => {
    renderCard("gia-pha", "en");
    expect(screen.getByRole("heading", { name: "Gia phả: a family-tree website" })).toBeInTheDocument();
  });

  for (const [locale, chip, label] of [
    ["vi", "Ảnh và dữ kiện giữ chỗ", "Phát lại từ lần chạy thật"],
    ["en", "Placeholder images and facts", "Replay of a real run"],
  ] as const) {
    it(`qualifies the Twistfit replay chip as placeholder in ${locale}`, () => {
      renderCard("twistfit", locale);
      expect(screen.getByText(label, { exact: true })).toBeInTheDocument();
      expect(screen.getByText(chip, { exact: true })).toBeInTheDocument();
    });

    it(`shows no placeholder qualifier on Gia phả and on the live (invite-only) Knowledge Base card in ${locale}`, () => {
      for (const slug of ["knowledge-base", "gia-pha"]) {
        const { unmount } = renderCard(slug, locale);
        expect(screen.queryByText(chip)).toBeNull();
        unmount();
      }
    });
  }
});
