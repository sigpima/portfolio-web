import { describe, expect, it, vi as vitest } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import SiteHeader from "./SiteHeader";
import viMessages from "../../messages/vi.json";
import enMessages from "../../messages/en.json";
import type { Locale } from "@/content/types";

let mockPathname = "/vi/projects";
let mockSearch = "";
vitest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => new URLSearchParams(mockSearch),
  useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {} }),
  redirect: () => {},
  permanentRedirect: () => {},
}));

function renderHeader(locale: Locale, pathname: string, search = "") {
  mockPathname = pathname;
  mockSearch = search;
  const messages = locale === "vi" ? viMessages : enMessages;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <SiteHeader locale={locale} />
    </NextIntlClientProvider>,
  );
}

describe("SiteHeader", () => {
  it("links to the same page with the /en prefix when locale is vi", () => {
    renderHeader("vi", "/vi/projects");
    expect(screen.getByRole("link", { name: "English" })).toHaveAttribute(
      "href",
      "/en/projects",
    );
  });

  it("links to the same page with the /vi prefix when locale is en", () => {
    renderHeader("en", "/en/projects/some-slug");
    expect(screen.getByRole("link", { name: "Tiếng Việt" })).toHaveAttribute(
      "href",
      "/vi/projects/some-slug",
    );
  });

  it("switches the locale on the home page", () => {
    renderHeader("vi", "/vi");
    expect(screen.getByRole("link", { name: "English" })).toHaveAttribute("href", "/en");
  });

  it("has a labelled nav with Trang chủ and Dự án links", () => {
    renderHeader("vi", "/vi");
    const nav = screen.getByRole("navigation", { name: "Điều hướng chính" });
    expect(nav).toHaveAttribute("aria-label");
    expect(screen.getByRole("link", { name: "Trang chủ" })).toHaveAttribute("href", "/vi");
    expect(screen.getByRole("link", { name: "Dự án" })).toHaveAttribute("href", "/vi/projects");
  });

  it("marks the current page link with aria-current", () => {
    renderHeader("en", "/en/projects");
    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
  });

  it("keeps the query string when switching language", () => {
    renderHeader("en", "/en/projects", "group=website");
    expect(screen.getByRole("link", { name: "Tiếng Việt" })).toHaveAttribute(
      "href",
      "/vi/projects?group=website",
    );
  });
});
