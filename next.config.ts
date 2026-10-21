import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { adminFrameHeaders } from "./src/lib/frame-headers";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  // The admin page and its API may never be framed by another site (clickjacking).
  async headers() {
    return adminFrameHeaders;
  },
};

export default withNextIntl(nextConfig);
