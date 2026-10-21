import type { Metadata } from "next";
import { fontVariables } from "../fonts";
import "../globals.css";

// Own root layout (outside [locale]): Vietnamese only, never indexed, no public header/footer.
export const metadata: Metadata = {
  title: "Quản trị · Link mời",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={fontVariables}>
      <body className="min-h-screen">
        <a href="#main" className="skip-link">
          Bỏ qua tới nội dung
        </a>
        <header className="border-b border-outline-variant/60">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-margin py-3">
            <p className="font-mono text-label-mono-sm uppercase text-on-surface-variant">Trang quản trị</p>
          </div>
        </header>
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-5xl px-margin py-6 md:py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
