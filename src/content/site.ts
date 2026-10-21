import type { Localized } from "./types";

/**
 * Personal details are placeholders until the owner confirms them.
 * Nothing here may be presented as fact before the `TODO:` markers are replaced.
 */
export const site: {
  name: string;
  title: Localized;
  bio: Localized;
  email: string;
  github: string;
  cv: string | null;
} = {
  name: "TODO: tên của bạn",
  title: { vi: "AI Engineer", en: "AI Engineer" },
  bio: {
    vi: "TODO: giới thiệu ngắn về bạn (vai trò, hướng chuyên môn)",
    en: "TODO: short bio about you (role, focus areas)",
  },
  email: "TODO: email liên hệ",
  github: "TODO: đường dẫn GitHub",
  cv: null,
};
