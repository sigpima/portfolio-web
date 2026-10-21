import type { Project } from "../types";

export const knowledgeBase: Project = {
  slug: "knowledge-base",
  group: "ai-agent",
  demoKind: "live",
  featured: true,
  order: 1,
  title: {
    vi: "Knowledge Base: hỏi đáp báo giá thi công sơn",
    en: "Knowledge Base: paint-contracting quotation Q&A",
  },
  tagline: {
    vi: "Agent AI trả lời câu hỏi về báo giá bằng số liệu từ Postgres (dữ liệu giả lập), qua 10 tool MCP chỉ đọc.",
    en: "An AI agent that answers quotation questions with figures from Postgres (synthetic data), through 10 read-only MCP tools.",
  },
  summary: {
    vi: "Kho dữ liệu báo giá và dự toán thi công sơn trong Postgres (19 bảng), nạp từ file YAML có kiểm tra, cùng một MCP server chỉ đọc để agent AI so sánh đơn giá và giải thích chênh lệch kèm số liệu cụ thể. Một bot Gemini gọi 10 tool MCP chỉ đọc đó để trả lời bằng tiếng Việt. Toàn bộ dữ liệu là giả lập: công ty \"Sơn Việt Demo Co.\", 24 công trình, 126 hạng mục; mọi tên công ty, công trình, thương hiệu đều là bịa.",
    en: "A Postgres store (19 tables) of paint-contracting quotations and cost estimates, loaded from validated YAML files, plus a read-only MCP server that lets an AI agent compare unit prices and explain differences with concrete figures. A Gemini bot calls those 10 read-only MCP tools and answers in Vietnamese. All data is fictional: the company \"Sơn Việt Demo Co.\", 24 projects and 126 work items; every company, project and brand name is invented.",
  },
  problem: {
    vi: "Người làm thầu thường phải trả lời những câu như \"báo giá này đắt hay rẻ so với các công trình đã làm?\" hay \"nhân công chiếm bao nhiêu phần trăm và có bất thường không?\". Trong Excel, đáp án nằm rải rác ở nhiều sheet (báo giá, định mức vật tư, bảng nhân công) và phải ghép tay.",
    en: "Contractors keep having to answer questions like \"is this quote expensive compared with past projects?\" or \"what share is labour, and is that unusual?\". In spreadsheets the answers are scattered across several sheets (quotation, material norms, labour table) and have to be stitched together by hand.",
  },
  approach: {
    vi: "Mỗi file YAML là một công trình, được kiểm tra rồi ghi vào Postgres trong một transaction (ghi đủ hoặc không ghi gì). MCP server chỉ đọc: kết nối bằng role Postgres chỉ đọc nên agent không thể ghi dù cố. Mỗi câu hỏi thường gặp có một tool trả lời bằng số liệu (so sánh đơn giá, chi tiết dự toán, nhân công, tỷ trọng chi phí), cộng một tool chỉ nhận câu SELECT cho các câu hỏi còn lại. Agent chỉ cần chọn tool rồi diễn giải bằng tiếng Việt; bot Gemini hiển thị từng lần gọi tool để người xem thấy số liệu đến từ đâu.",
    en: "Each YAML file describes one project; it is validated and written to Postgres in a single transaction (all or nothing). The MCP server is read-only: it connects with a read-only Postgres role, so an agent cannot write even if it tries. Each common question has a tool that answers with figures (unit-price comparison, estimate detail, labour cost, cost breakdown), plus one SELECT-only tool for everything else. The agent just picks a tool and explains the result in Vietnamese; the Gemini bot shows every tool call so viewers can see where the numbers come from.",
  },
  highlights: {
    vi: [
      "10 tool MCP chỉ đọc, gồm một tool SQL chỉ nhận SELECT/WITH và trả tối đa 200 dòng.",
      "Ghi và đọc tách thành hai service; MCP server dùng role Postgres chỉ đọc nên DB tự từ chối mọi thao tác ghi.",
      "Nhập dữ liệu có kiểm tra, báo lỗi kèm vị trí trong file YAML, ghi trong một transaction.",
      "Bot Gemini gọi tool MCP và phát câu trả lời qua SSE: người xem thấy từng lần gọi tool trước khi có câu trả lời.",
      "Dữ liệu mẫu giả lập, sinh tất định bằng script và có test bảo đảm thư mục khớp đầu ra của bộ sinh.",
    ],
    en: [
      "10 read-only MCP tools, including a SQL tool that accepts only SELECT/WITH and returns at most 200 rows.",
      "Writing and reading are separate services; the MCP server uses a read-only Postgres role, so the database itself rejects any write.",
      "Validated ingestion: errors point to the location in the YAML file, and writes happen in one transaction.",
      "A Gemini bot calls the MCP tools and streams its answer over SSE, so viewers see each tool call before the answer.",
      "Fictional sample data, generated deterministically by a script, with a test ensuring the data folder matches the generator output.",
    ],
  },
  tech: ["Python", "FastAPI", "PostgreSQL", "SQLAlchemy", "MCP", "Gemini", "Docker"],
  // TODO: thêm liên kết repo khi chủ dự án xác nhận repo được công khai.
  links: [],
  cover: "/projects/knowledge-base.svg",
  demo: { component: "knowledge-base" },
};
