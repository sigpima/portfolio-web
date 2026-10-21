import { setRequestLocale } from "next-intl/server";

// Placeholder: Task 8 replaces this with the real home page.
export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <div className="px-margin py-10 md:px-margin-tablet lg:px-margin-desktop" />;
}
