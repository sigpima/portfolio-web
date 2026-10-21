import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import { listProjects } from "@/content/registry";
import type { Project } from "@/content/types";
import enMessages from "../../messages/en.json";
import { HomeProjectSections, splitHomeProjects } from "./HomeProjects";

const base = listProjects();
const kb = base.find((p) => p.slug === "knowledge-base")!;

function fake(slug: string, overrides: Partial<Project>): Project {
  const l = (s: string) => ({ vi: `${s} vi`, en: `${s} en` });
  return {
    ...kb,
    slug,
    title: l(`Title ${slug}`),
    tagline: l(`Tagline ${slug}`),
    demoKind: "none",
    demo: undefined,
    featured: false,
    ...overrides,
  };
}

// A 4th ai-agent project (not featured) and a second featured website project.
const fourth = fake("agent-four", { group: "ai-agent", order: 4 });
const fifth = fake("site-five", { group: "website", order: 5, featured: true });
const list = [...base, fourth, fifth];

describe("splitHomeProjects", () => {
  it("features every featured project by order and lists every other project", () => {
    const { featured, others } = splitHomeProjects(list);
    expect(featured.map((p) => p.slug)).toEqual(["knowledge-base", "site-five"]);
    expect(others.map((p) => p.slug)).toEqual(["twistfit", "gia-pha", "agent-four"]);
  });

  it("works with the real registry: KB featured, the rest listed", () => {
    const { featured, others } = splitHomeProjects(base);
    expect(featured.map((p) => p.slug)).toEqual(["knowledge-base"]);
    expect(others.map((p) => p.slug)).toEqual(
      base.filter((p) => p.slug !== "knowledge-base").map((p) => p.slug),
    );
  });
});

describe("HomeProjectSections", () => {
  it("renders a 4th ai-agent project and a second featured project", () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <HomeProjectSections projects={list} locale="en" />
      </NextIntlClientProvider>,
    );
    const featured = screen.getByRole("region", { name: "Start here" });
    expect(within(featured).getByRole("heading", { name: kb.title.en })).toBeInTheDocument();
    expect(within(featured).getByRole("heading", { name: "Title site-five en" })).toBeInTheDocument();
    const others = screen.getByRole("region", { name: "Other projects" });
    for (const name of ["Title agent-four en", "Twistfit: outfit matching by personal colour", "Gia phả: a family-tree website"]) {
      expect(within(others).getByRole("heading", { name })).toBeInTheDocument();
    }
    expect(within(others).queryByRole("heading", { name: kb.title.en })).toBeNull();
  });
});
