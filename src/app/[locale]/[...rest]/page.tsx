import { notFound } from "next/navigation";

// Any unknown path under /{locale}/ renders the localized not-found page
// (inside the locale layout) instead of the global one.
export default function CatchAll() {
  notFound();
}
