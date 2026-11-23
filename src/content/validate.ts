import type { Localized, Project } from "./types";

const LOCALES = ["vi", "en"] as const;

function blank(value: unknown): boolean {
  return typeof value !== "string" || value.trim() === "";
}

/**
 * Returns a list of human-readable errors; an empty list means the registry is valid.
 * `knownDemos` is the set of demo component keys that actually exist.
 */
export function validateProjects(projects: Project[], knownDemos: string[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const project of projects) {
    const id = project.slug || "(thiếu slug)";

    if (blank(project.slug)) {
      errors.push(`${id}: slug rỗng`);
    } else if (seen.has(project.slug)) {
      errors.push(`${id}: slug trùng (duplicate slug)`);
    }
    seen.add(project.slug);

    const localizedFields: [string, Localized][] = [
      ["title", project.title],
      ["tagline", project.tagline],
      ["summary", project.summary],
      ["problem", project.problem],
      ["approach", project.approach],
    ];
    for (const [field, value] of localizedFields) {
      for (const locale of LOCALES) {
        if (blank(value?.[locale])) {
          errors.push(`${id}: ${field}.${locale} rỗng`);
        }
      }
    }

    for (const locale of LOCALES) {
      const list = project.highlights?.[locale];
      if (!Array.isArray(list) || list.length === 0) {
        errors.push(`${id}: highlights.${locale} rỗng`);
      } else if (list.some(blank)) {
        errors.push(`${id}: highlights.${locale} có mục rỗng`);
      }
    }

    project.links?.forEach((link, index) => {
      for (const locale of LOCALES) {
        if (blank(link.label?.[locale])) {
          errors.push(`${id}: links[${index}].label.${locale} rỗng`);
        }
      }
      if (blank(link.href)) {
        errors.push(`${id}: links[${index}].href rỗng`);
      }
    });

    if (project.demoSoon && project.demoKind !== "none") {
      errors.push(`${id}: demoSoon chỉ dùng khi demoKind là "none"`);
    }
    if (project.website !== undefined && !/^https:\/\/\S+$/.test(project.website)) {
      errors.push(`${id}: website phải là địa chỉ https`);
    }

    if (project.demoKind === "none") {
      if (project.demo) {
        errors.push(`${id}: demoKind là "none" nhưng lại có demo`);
      }
    } else if (!project.demo) {
      errors.push(`${id}: demoKind là "${project.demoKind}" nhưng thiếu demo`);
    } else if (!knownDemos.includes(project.demo.component)) {
      errors.push(`${id}: demo.component "${project.demo.component}" không nằm trong danh sách demo đã biết`);
    }
  }

  return errors;
}
