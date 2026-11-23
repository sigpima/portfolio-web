export type Locale = "vi" | "en";

export type Localized<T = string> = Record<Locale, T>;

export type ProjectGroup = "website" | "ai-agent";

export type DemoKind = "live" | "replay" | "simulation" | "none";

export interface Project {
  slug: string;
  group: ProjectGroup;
  demoKind: DemoKind;
  featured: boolean;
  order: number;
  title: Localized;
  tagline: Localized;
  summary: Localized;
  problem: Localized;
  approach: Localized;
  highlights: Localized<string[]>;
  tech: string[];
  links: { label: Localized; href: string }[];
  /** Public path, e.g. `/projects/knowledge-base.svg`. */
  cover: string;
  demo?: { component: string };
  /** The project's real, public website (https). Shown as the way to try it while there is no demo. */
  website?: string;
  /** No demo yet: the page says "demo coming soon" and points at the website. Needs demoKind "none". */
  demoSoon?: boolean;
}
