import type { MetadataRoute } from "next";

/** Keep crawlers out of the admin page, the API routes and the invite links. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/i/"],
    },
  };
}
