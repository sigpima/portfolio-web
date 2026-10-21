import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import type { Locale, ProjectGroup } from "@/content/types";
import viMessages from "../../messages/vi.json";
import enMessages from "../../messages/en.json";
import { GroupFilter } from "./GroupFilter";

function renderFilter(locale: Locale, active: ProjectGroup | null) {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "vi" ? viMessages : enMessages}>
      <GroupFilter locale={locale} active={active} />
    </NextIntlClientProvider>,
  );
}

describe("GroupFilter", () => {
  it("links each group with ?group= and All without the param (vi)", () => {
    renderFilter("vi", null);
    expect(screen.getByRole("link", { name: /^Tất cả/ })).toHaveAttribute("href", "/vi/projects");
    expect(screen.getByRole("link", { name: /^Website/ })).toHaveAttribute(
      "href",
      "/vi/projects?group=website",
    );
    expect(screen.getByRole("link", { name: /^AI \/ LLM \/ Agent/ })).toHaveAttribute(
      "href",
      "/vi/projects?group=ai-agent",
    );
  });

  it("marks All as current when no group is active", () => {
    renderFilter("en", null);
    expect(screen.getByRole("link", { name: /^All/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /^Website/ })).not.toHaveAttribute("aria-current");
  });

  it("marks the active group with aria-current (en)", () => {
    renderFilter("en", "ai-agent");
    expect(screen.getByRole("link", { name: /^AI \/ LLM \/ Agent/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: /^All/ })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: /^All/ })).toHaveAttribute("href", "/en/projects");
  });

  it("is a labelled navigation", () => {
    renderFilter("vi", "website");
    expect(screen.getByRole("navigation", { name: "Lọc theo nhóm" })).toBeInTheDocument();
  });
});
