import Link from "next/link";
import { fontVariables } from "./fonts";
import "./globals.css";

// Global 404 (e.g. unknown locale such as /fr). Rendered outside the
// [locale] layout, so it ships its own <html>/<body> and is bilingual.
export default function GlobalNotFound() {
  return (
    <html lang="en" className={fontVariables}>
      <body>
        <main className="mx-auto flex min-h-screen max-w-xl flex-col items-start justify-center gap-4 px-margin">
          <p className="font-mono text-label-mono-sm text-secondary">404</p>
          <h1 className="text-headline-lg text-on-surface">
            Page not found
            <span lang="vi" className="block text-on-surface-variant">
              Không tìm thấy trang
            </span>
          </h1>
          <p className="text-body-lg text-on-surface-variant">
            <Link className="text-primary underline underline-offset-4" href="/en">
              English
            </Link>
            {" · "}
            <Link lang="vi" className="text-primary underline underline-offset-4" href="/vi">
              Tiếng Việt
            </Link>
          </p>
        </main>
      </body>
    </html>
  );
}
