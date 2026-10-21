import type { Project } from "../types";

export const giaPha: Project = {
  slug: "gia-pha",
  group: "website",
  demoKind: "simulation",
  featured: false,
  order: 3,
  title: {
    vi: "Gia phả: website cây gia đình",
    en: "Gia phả: a family-tree website",
  },
  tagline: {
    vi: "Website gia phả nhiều dòng họ; tính năng nhập liệu bằng AI đang phát triển, trang này có bản mô phỏng.",
    en: "A multi-family genealogy website; AI data entry is in development, and this page shows a simulation.",
  },
  summary: {
    vi: "Website gia phả (Next.js và FastAPI) với cây gia đình tương tác, hồ sơ từng người (ngày âm lịch, quê quán, vợ/chồng, con nuôi), lịch giỗ tính theo âm lịch, sử ký dòng họ, thư viện ảnh, bản đồ nơi an nghỉ, phân quyền và xuất ảnh hoặc PDF. Tính năng nhập liệu bằng AI (đọc file Word bằng LLM để trích tên và quan hệ) chưa được xây dựng; phần demo trên trang này là bản mô phỏng của tính năng đang phát triển, dùng file Word mẫu giả và kết quả soạn sẵn, không gọi LLM thật.",
    en: "A genealogy website (Next.js and FastAPI) with an interactive family tree, per-person profiles (lunar dates, hometown, spouses, adopted children), death-anniversary calendar computed from the lunar calendar, family history articles, photo library, a map of resting places, role-based access, and PNG or PDF export. AI data entry (reading a Word file with an LLM to extract people and relations) is not built yet; the demo on this page is a simulation of a feature in development, using a fictional sample Word file and a pre-written result, with no real LLM call.",
  },
  problem: {
    vi: "Dữ liệu gia phả thường nằm trong file Word, giấy tờ hoặc trí nhớ của người lớn tuổi, nhập từng người vào hệ thống rất tốn công. Với một họ có hàng trăm người, việc nhập liệu quyết định website có dùng được hay không.",
    en: "Genealogy data usually lives in Word files, paper records or the memory of elders, and entering people one by one is slow. For a family of hundreds, data entry decides whether the website is usable at all.",
  },
  approach: {
    vi: "Website hiện có: cây vẽ bằng d3, mượt với hàng nghìn người, mỗi dòng họ một cây riêng với quản trị viên riêng, người dùng được mời bằng liên kết gắn với từng người trong cây, và có trang nhập liệu hàng loạt, nhập hoặc xuất CSV. Tính năng AI đang phát triển (chưa có): đọc một file Word, dùng LLM trích tên và quan hệ, rồi dựng thành các nhánh cây để người dùng duyệt. Việc hỗ trợ ảnh chụp và ảnh scan giấy tờ gia phả là kế hoạch, chưa có trong bản mô phỏng.",
    en: "What exists today: a d3-drawn tree that stays smooth with thousands of people, a separate tree and administrator per family, users invited through links tied to a specific person in the tree, and a bulk data-entry page with CSV import and export. The AI feature in development (not built yet): read a Word file, have an LLM extract names and relations, then build tree branches for the user to review. Support for photos and scans of genealogy documents is planned and is not part of the simulation.",
  },
  highlights: {
    vi: [
      "Cây gia phả tương tác bằng d3: thu hoặc mở nhánh, xem tổ tiên, tìm không dấu.",
      "Lịch giỗ tự tính từ ngày mất âm lịch của từng người, kèm liên kết lịch .ics.",
      "Nhiều dòng họ trên một hệ thống: mỗi họ một cây và một quản trị viên riêng.",
      "Yêu cầu cập nhật để thành viên đề xuất sửa, quản trị viên duyệt, kèm nhật ký thay đổi.",
      "Xuất ảnh cây (PNG hoặc PDF), quyển phả PDF, sao lưu và khôi phục.",
      "Nhập liệu bằng AI từ file Word: đang phát triển, trang này là bản mô phỏng. Ảnh chụp và ảnh scan: kế hoạch.",
    ],
    en: [
      "Interactive d3 family tree: collapse or expand branches, view ancestors, accent-insensitive search.",
      "Death-anniversary calendar computed from each person's lunar death date, with an .ics calendar link.",
      "Several families on one system: each has its own tree and administrator.",
      "Update requests so members can propose edits that an administrator reviews, with a change log.",
      "Tree export (PNG or PDF), a PDF family book, backup and restore.",
      "AI data entry from a Word file: in development, and this page is a simulation. Photos and scans: planned.",
    ],
  },
  tech: ["Next.js", "React", "TypeScript", "d3", "FastAPI", "PostgreSQL", "Docker"],
  // TODO: thêm liên kết repo khi chủ dự án xác nhận repo được công khai.
  links: [],
  cover: "/projects/gia-pha.svg",
  demo: { component: "gia-pha-simulation" },
};
