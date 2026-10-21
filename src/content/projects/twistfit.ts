import type { Project } from "../types";

export const twistfit: Project = {
  slug: "twistfit",
  group: "website",
  demoKind: "replay",
  featured: false,
  order: 2,
  title: {
    vi: "Twistfit: phối đồ theo màu cá nhân",
    en: "Twistfit: outfit matching by personal colour",
  },
  tagline: {
    vi: "Website thời trang gợi ý bộ đồ từ tủ đồ của bạn và dựng ảnh mặc thử bằng Flux.",
    en: "A fashion website that suggests outfits from your wardrobe and renders a try-on image with Flux.",
  },
  summary: {
    vi: "Twistfit là website thời trang (Next.js và FastAPI) có khảo sát màu sắc cá nhân theo mùa, tủ đồ cá nhân và tính năng phối đồ mặc thử. Người dùng tải ảnh quần áo lên tủ đồ; khi chọn dịp hoặc phong cách, hệ thống ghép một bộ phù hợp với màu cá nhân của họ rồi gọi Flux để dựng ảnh người mẫu mặc bộ đó. Demo trên trang này phát lại các bước của một lượt mặc thử bằng Flux và không gọi Flux khi có người xem.",
    en: "Twistfit is a fashion website (Next.js and FastAPI) with a seasonal personal-colour quiz, a personal wardrobe and an outfit try-on feature. Users upload clothing photos to their wardrobe; when they pick an occasion or a style, the system assembles a matching outfit for their personal colours and calls Flux to render a model wearing it. The demo on this page replays the steps of a Flux try-on run and does not call Flux when someone views it.",
  },
  problem: {
    vi: "Chọn đồ hợp với tông màu cá nhân, hợp dịp và hợp phong cách mất nhiều thời gian, và khó hình dung bộ đồ khi mặc lên người trước khi quyết định.",
    en: "Choosing clothes that suit your personal colours, the occasion and your style takes time, and it is hard to picture an outfit on a body before deciding.",
  },
  approach: {
    vi: "Mỗi món đồ trong tủ được gán thẻ (loại, phong cách, dịp) bằng Gemini khi tải lên, kèm màu chủ đạo trích bằng xử lý ảnh; người dùng xem và sửa thẻ trước khi lưu. Khi tạo một lượt phối đồ, backend chọn bộ đồ theo ba tiêu chí có trọng số (màu so với bảng màu theo mùa của người dùng 50%, phong cách 30%, dịp 20%), trừ điểm nhẹ những món đã dùng nhiều lần. Các món được gộp vào một ảnh tham chiếu duy nhất và gửi tới Flux API cùng ảnh người mẫu để dựng ảnh mặc thử. Mỗi người dùng có hạn mức 5 lượt mỗi ngày, được hoàn lại nếu lượt lỗi trước khi gọi Flux.",
    en: "Each wardrobe item is tagged (category, style, occasion) by Gemini on upload, with dominant colours extracted by image processing; users review and edit the tags before saving. When a try-on is requested, the backend picks an outfit by a weighted score (colour against the user's seasonal palette 50%, style 30%, occasion 20%), with a small penalty for items already used often. The chosen items are merged into one reference image and sent to the Flux API together with the model photo to render the try-on. Each user has a limit of 5 try-ons per day, refunded if the job fails before reaching Flux.",
  },
  highlights: {
    vi: [
      "Chấm điểm bộ đồ theo màu cá nhân, phong cách và dịp thay vì chọn ngẫu nhiên.",
      "Gộp nhiều món thành một ảnh tham chiếu và gọi Flux một lần cho mỗi góc chụp (chính diện, và nghiêng nếu có).",
      "Tác vụ chạy nền với trạng thái pending, processing, done hoặc failed lưu trong Postgres, không cần Redis hay Celery.",
      "Hạn mức mỗi ngày được đặt trước an toàn khi nhiều yêu cầu đồng thời, và hoàn lại khi lỗi xảy ra trước lệnh gọi Flux có tính phí.",
      "Gemini gắn thẻ ảnh quần áo, người dùng duyệt lại thẻ trước khi lưu.",
    ],
    en: [
      "Outfits are scored by personal colour, style and occasion rather than picked at random.",
      "Several garments are merged into one reference image, with one Flux call per angle (front, and side when provided).",
      "Jobs run in the background with a pending, processing, done or failed status stored in Postgres, with no Redis or Celery.",
      "The daily quota is reserved safely under concurrent requests and refunded when the failure happens before the paid Flux call.",
      "Gemini tags clothing photos, and users review the tags before saving.",
    ],
  },
  tech: ["Next.js", "React", "TypeScript", "FastAPI", "PostgreSQL", "MinIO", "Gemini", "Flux"],
  // TODO: thêm liên kết repo khi chủ dự án xác nhận repo được công khai.
  links: [],
  cover: "/projects/twistfit.svg",
  demo: { component: "twistfit-replay" },
};
