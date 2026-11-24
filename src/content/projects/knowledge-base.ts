import type { Project } from "../types";

export const knowledgeBase: Project = {
  slug: "knowledge-base",
  group: "ai-agent",
  demoKind: "live",
  featured: true,
  order: 1,
  title: {
    vi: "Knowledge Base: hỏi đáp báo giá và chính sách thi công sơn",
    en: "Knowledge Base: paint-contracting quotation and policy Q&A",
  },
  tagline: {
    vi: "Agent AI trả lời hai loại câu hỏi: số liệu báo giá từ Postgres và quy định chính sách từ tài liệu tra cứu bằng RAG (Milvus), qua 11 tool MCP chỉ đọc; dữ liệu giả lập.",
    en: "An AI agent that answers two kinds of questions: quotation figures from Postgres, and policy rules from documents retrieved with RAG (Milvus), through 11 read-only MCP tools; synthetic data.",
  },
  summary: {
    vi: "Hai nguồn dữ liệu, một agent. Kho báo giá và dự toán thi công sơn trong Postgres (19 bảng), nạp từ file YAML có kiểm tra, trả lời các câu hỏi về số liệu. Kho tài liệu chính sách (12 tài liệu về quy trình thi công, định mức, bảo hành và nghiệm thu, cắt thành 68 đoạn, nhúng bằng Gemini và lưu trong Milvus) trả lời các câu hỏi về quy định. Một MCP server chỉ đọc đưa cả hai nguồn ra thành 11 tool; bot Gemini chọn tool rồi trả lời bằng ngôn ngữ của câu hỏi (tiếng Việt hoặc tiếng Anh; bản thân dữ liệu là tiếng Việt), kèm trích nguồn khi dùng chính sách. Toàn bộ dữ liệu là giả lập: công ty \"Sơn Việt Demo Co.\", 24 công trình, 126 hạng mục; mọi tên công ty, công trình, thương hiệu đều là bịa.",
    en: "Two data sources, one agent. A Postgres store (19 tables) of paint-contracting quotations and cost estimates, loaded from validated YAML files, answers the questions about figures. A store of policy documents (12 documents on work procedures, norms, warranty and acceptance, split into 68 passages, embedded with Gemini and kept in Milvus) answers the questions about rules. One read-only MCP server exposes both as 11 tools; a Gemini bot picks the tools and answers in the language of the question (Vietnamese or English; the data itself is in Vietnamese), citing its sources when it uses policy. All data is fictional: the company \"Sơn Việt Demo Co.\", 24 projects and 126 work items; every company, project and brand name is invented.",
  },
  problem: {
    vi: "Người làm thầu thường phải trả lời hai kiểu câu hỏi. Kiểu thứ nhất là số liệu: \"báo giá này đắt hay rẻ so với các công trình đã làm?\", \"nhân công chiếm bao nhiêu phần trăm và có bất thường không?\"; trong Excel, đáp án nằm rải rác ở nhiều sheet (báo giá, định mức vật tư, bảng nhân công) và phải ghép tay. Kiểu thứ hai là quy định: \"bảo hành chống thấm được bao lâu?\", \"bảo hành tính từ ngày nào?\"; câu trả lời nằm trong các tài liệu quy trình và chính sách, phải mở đọc từng file. Câu hỏi kiểu \"vì sao hai báo giá khác nhau\" thường cần cả hai: con số lấy từ báo giá, lý do lấy từ quy định.",
    en: "Contractors keep having to answer two kinds of questions. The first is about figures: \"is this quote expensive compared with past projects?\", \"what share is labour, and is that unusual?\"; in spreadsheets the answers are scattered across several sheets (quotation, material norms, labour table) and have to be stitched together by hand. The second is about rules: \"how long is the waterproofing warranty?\", \"when does the warranty start?\"; the answers sit in procedure and policy documents that someone has to open and read one by one. A question like \"why do two quotes differ\" usually needs both: the numbers come from the quotation, the reasons from the rules.",
  },
  approach: {
    vi: "Hai nguồn, một agent, một cổng chỉ đọc. Số liệu: mỗi file YAML là một công trình, được kiểm tra rồi ghi vào Postgres trong một transaction (ghi đủ hoặc không ghi gì); MCP server kết nối bằng role Postgres chỉ đọc nên agent không thể ghi dù cố. Mỗi câu hỏi thường gặp có một tool trả lời bằng số liệu (so sánh đơn giá, chi tiết dự toán, nhân công, tỷ trọng chi phí), cộng một tool chỉ nhận câu SELECT cho các câu hỏi còn lại. Chính sách: 12 tài liệu Markdown được cắt theo heading thành 68 đoạn, nhúng bằng Gemini và lưu trong Milvus; tool search_policies nhúng câu hỏi bằng cùng model, tìm các đoạn gần nhất (bỏ đoạn có điểm dưới ngưỡng 0,65), và bot được hướng dẫn chỉ dựa vào các đoạn đó và trích nguồn kèm tên tài liệu và mục. Agent chọn tool, có thể gọi nhiều lần, rồi diễn giải bằng ngôn ngữ của câu hỏi; câu hỏi kiểu \"vì sao đơn giá khác nhau\" dùng cả hai nguồn. Bot hiển thị từng lần gọi tool (Postgres hay Milvus) để người xem thấy số liệu hay quy định đến từ đâu, và bấm vào trích dẫn để đọc đúng đoạn tài liệu.",
    en: "Two sources, one agent, one read-only gateway. Figures: each YAML file describes one project; it is validated and written to Postgres in a single transaction (all or nothing), and the MCP server connects with a read-only Postgres role, so an agent cannot write even if it tries. Each common question has a tool that answers with figures (unit-price comparison, estimate detail, labour cost, cost breakdown), plus one SELECT-only tool for everything else. Policy: 12 Markdown documents are split by heading into 68 passages, embedded with Gemini and stored in Milvus; the search_policies tool embeds the question with the same model and finds the closest passages (dropping any scoring below the 0.65 threshold), and the bot is instructed to rely only on those passages and cite document and section. The agent picks tools, can call several, and explains the result in the language of the question; a \"why do the unit prices differ\" question uses both sources. The bot shows every tool call (Postgres or Milvus) so viewers can see where the figures or the rules come from, and a click on a citation opens the cited passage of the document.",
  },
  highlights: {
    vi: [
      "Hai nguồn dữ liệu trong một agent: số liệu báo giá từ Postgres và quy định từ RAG trên Milvus, qua 11 tool MCP chỉ đọc (gồm một tool tra cứu chính sách và một tool SQL chỉ nhận SELECT/WITH, tối đa 200 dòng).",
      "Hỏi đáp chính sách bằng RAG: 12 tài liệu giả lập (68 đoạn) nhúng bằng Gemini, lưu trong Milvus; bot trích nguồn kèm tên tài liệu và mục. Đánh giá truy xuất ngày 2026-11-06 trên 28 câu: recall@5 mức tài liệu 24/24 câu trong phạm vi, MRR 0,975 ở câu một nguồn; mẫu nhỏ, ngưỡng điểm 0,65.",
      "Bot Gemini gọi tool MCP và phát câu trả lời qua SSE: người xem thấy từng lần gọi tool (Postgres hay Milvus), xem tham số và kết quả dạng JSON, và bấm trích dẫn để đọc đúng đoạn chính sách.",
      "Ghi và đọc tách thành hai service; MCP server dùng role Postgres chỉ đọc nên DB tự từ chối mọi thao tác ghi.",
      "Nhập dữ liệu có kiểm tra, báo lỗi kèm vị trí trong file YAML, ghi trong một transaction.",
      "Dữ liệu mẫu giả lập, sinh tất định bằng script và có test bảo đảm thư mục khớp đầu ra của bộ sinh.",
    ],
    en: [
      "Two data sources in one agent: quotation figures from Postgres and rules from RAG over Milvus, through 11 read-only MCP tools (including a policy search tool and a SQL tool that accepts only SELECT/WITH and returns at most 200 rows).",
      "Policy Q&A with RAG: 12 fictional documents (68 passages) embedded with Gemini and stored in Milvus; the bot cites document and section. Retrieval evaluated on 2026-11-06 over 28 questions: document-level recall@5 of 24/24 in-scope questions, MRR 0.975 on single-source ones; a small sample, score threshold 0.65.",
      "A Gemini bot calls the MCP tools and streams its answer over SSE: viewers see each tool call (Postgres or Milvus), open its arguments and result as JSON, and click a citation to read the cited policy passage.",
      "Writing and reading are separate services; the MCP server uses a read-only Postgres role, so the database itself rejects any write.",
      "Validated ingestion: errors point to the location in the YAML file, and writes happen in one transaction.",
      "Fictional sample data, generated deterministically by a script, with a test ensuring the data folder matches the generator output.",
    ],
  },
  tech: ["Python", "FastAPI", "PostgreSQL", "SQLAlchemy", "MCP", "Gemini", "Milvus", "RAG", "Docker"],
  // TODO: thêm liên kết repo khi chủ dự án xác nhận repo được công khai.
  links: [],
  cover: "/projects/knowledge-base.svg",
  demo: { component: "knowledge-base" },
};
