import type { Localized } from "./types";

/**
 * Personal details are placeholders until the owner confirms them.
 * Nothing here may be presented as fact before the `TODO:` markers are replaced.
 */
export const site: {
  name: Localized;
  title: Localized;
  bio: Localized;
  email: string;
  github: string;
  linkedin: string;
  cv: string | null;
  /** Public path of the avatar, e.g. "/avatar.jpg" (file in public/). null shows a neutral placeholder. */
  avatar: string | null;
} = {
  name: { vi: "Nguyễn Văn Nhật Tiến", en: "Tien Nguyen Van Nhat" },
  title: { vi: "AI Engineer", en: "AI Engineer" },
  bio: {
    vi: "AI Engineer xây các hệ thống LLM và agent chạy được thật, kèm phần web để người dùng tự thử. Tôi chú ý đến việc mô hình ra quyết định thế nào, nên mỗi dự án ở đây cho bạn xem từng bước thay vì chỉ kết quả.",
    en: "AI Engineer building LLM and agent systems that actually run, with web products around them so people can try them. I care about how the model reaches its answers, so each project here shows the steps, not just the result.",
  },
  email: "chainpima.work@gmail.com",
  github: "https://github.com/sigpima",
  linkedin: "https://www.linkedin.com/in/sig-pima",
  cv: null,
  avatar: "/avatar.jpg",
};
