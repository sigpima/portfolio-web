import type { ReplayDefinition } from "./types";

/*
 * Gia phả AI data entry: a SIMULATION of a feature in development (not built).
 * The Word file, its excerpt and every person below are entirely fictional; the
 * result is pre-written and no LLM is called. Photos/scans are planned only.
 */
export const giaPhaReplay: ReplayDefinition = {
  id: "gia-pha",
  samples: [
    {
      id: "ho-nguyen-mau",
      title: { vi: "Họ Nguyễn (mẫu giả)", en: "The Nguyễn family (fictional sample)" },
      input: {
        kind: "file",
        fileName: "gia-pha-ho-nguyen-mau.docx",
        excerpt: {
          vi: [
            "Cụ ông Nguyễn Văn Thành (1921–1994) kết hôn với cụ bà Trần Thị Mai (1925–2008).",
            "Hai cụ sinh được ông Nguyễn Văn Hùng (1948–2015) và bà Nguyễn Thị Lan (sinh 1952).",
            "Ông Hùng lấy bà Phạm Thị Hoa (sinh 1950), sinh con trai Nguyễn Văn Minh (sinh 1975).",
            "Bà Lan lấy ông Đỗ Văn Bình (1949–2020), sinh con gái Đỗ Thị Thu (sinh 1978).",
            "Anh Minh lấy chị Vũ Thị Ngọc (sinh 1979), sinh hai con: Nguyễn Minh Khôi (sinh 2005) và Nguyễn Ngọc Anh (sinh 2008).",
          ],
          en: [
            "Mr Nguyễn Văn Thành (1921–1994) married Mrs Trần Thị Mai (1925–2008).",
            "They had Mr Nguyễn Văn Hùng (1948–2015) and Mrs Nguyễn Thị Lan (born 1952).",
            "Mr Hùng married Mrs Phạm Thị Hoa (born 1950); their son is Nguyễn Văn Minh (born 1975).",
            "Mrs Lan married Mr Đỗ Văn Bình (1949–2020); their daughter is Đỗ Thị Thu (born 1978).",
            "Minh married Vũ Thị Ngọc (born 1979); they have two children: Nguyễn Minh Khôi (born 2005) and Nguyễn Ngọc Anh (born 2008).",
          ],
        },
      },
      nodes: [
        {
          id: "read",
          label: { vi: "Đọc file Word", en: "Read the Word file" },
          sublabel: { vi: ".docx", en: ".docx" },
        },
        {
          id: "extract",
          label: { vi: "LLM trích tên và quan hệ", en: "LLM extracts names and relations" },
          sublabel: { vi: "mô phỏng", en: "simulated" },
        },
        {
          id: "build",
          label: { vi: "Dựng cây gia phả", en: "Build the family tree" },
          sublabel: { vi: "để người dùng duyệt", en: "for the user to review" },
        },
      ],
      steps: [
        { atMs: 0, nodeId: "read", status: "active" },
        {
          atMs: 800,
          nodeId: "read",
          status: "done",
          detail: { vi: "5 đoạn văn", en: "5 paragraphs" },
        },
        { atMs: 1000, nodeId: "extract", status: "active" },
        {
          atMs: 2800,
          nodeId: "extract",
          status: "done",
          detail: {
            vi: "11 người, 4 cặp vợ chồng, 12 quan hệ cha mẹ – con (kết quả soạn sẵn)",
            en: "11 people, 4 couples, 12 parent–child links (pre-written result)",
          },
        },
        { atMs: 3000, nodeId: "build", status: "active" },
        {
          atMs: 3800,
          nodeId: "build",
          status: "done",
          detail: { vi: "4 đời", en: "4 generations" },
        },
      ],
      result: {
        kind: "people",
        people: [
          { id: "thanh", name: "Nguyễn Văn Thành", birthYear: 1921, deathYear: 1994, parentIds: [] },
          { id: "mai", name: "Trần Thị Mai", birthYear: 1925, deathYear: 2008, parentIds: [] },
          { id: "hung", name: "Nguyễn Văn Hùng", birthYear: 1948, deathYear: 2015, parentIds: ["thanh", "mai"] },
          { id: "hoa", name: "Phạm Thị Hoa", birthYear: 1950, parentIds: [] },
          { id: "lan", name: "Nguyễn Thị Lan", birthYear: 1952, parentIds: ["thanh", "mai"] },
          { id: "binh", name: "Đỗ Văn Bình", birthYear: 1949, deathYear: 2020, parentIds: [] },
          { id: "minh", name: "Nguyễn Văn Minh", birthYear: 1975, parentIds: ["hung", "hoa"] },
          { id: "thu", name: "Đỗ Thị Thu", birthYear: 1978, parentIds: ["binh", "lan"] },
          { id: "ngoc", name: "Vũ Thị Ngọc", birthYear: 1979, parentIds: [] },
          { id: "khoi", name: "Nguyễn Minh Khôi", birthYear: 2005, parentIds: ["minh", "ngoc"] },
          { id: "ngoc-anh", name: "Nguyễn Ngọc Anh", birthYear: 2008, parentIds: ["minh", "ngoc"] },
        ],
      },
    },
  ],
};
