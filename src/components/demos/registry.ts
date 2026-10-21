import type { ComponentType } from "react";
import type { Locale } from "@/content/types";
import { KnowledgeBaseDemo } from "./KnowledgeBaseDemo";

/** Demo components by `Project.demo.component` key. */
export const demoComponents: Record<string, ComponentType<{ locale: Locale }>> = {
  "knowledge-base": KnowledgeBaseDemo,
};
