import type { Project, ProjectGroup } from "./types";
import { knowledgeBase } from "./projects/knowledge-base";
import { twistfit } from "./projects/twistfit";
import { giaPha } from "./projects/gia-pha";

export const projects: Project[] = [knowledgeBase, twistfit, giaPha];

export function getProject(slug: string): Project | undefined {
  return projects.find((project) => project.slug === slug);
}

export function listProjects(group?: ProjectGroup): Project[] {
  return projects
    .filter((project) => group === undefined || project.group === group)
    .sort((a, b) => a.order - b.order);
}
