import { recordedSamples } from "./knowledge-base.recorded";
import type { ReplayDefinition, ReplaySample } from "./types";

/*
 * Knowledge Base replays, shown to visitors without an invite link.
 *
 * Real samples come ONLY from `npm run record:kb` (scripts/record-kb-replay.ts), which
 * asks the chat service the suggestion questions and writes `knowledge-base.recorded.ts`
 * with the real events' timings, details and answers.
 *
 * Until then there is one placeholder sample (`placeholder: true`) built on the README's
 * "latest quotation" example: the tool, its arguments, timings, row and answer are
 * ILLUSTRATIVE, not from a run, and say so ("(minh hoạ)" / "(illustrative)").
 * Node ids and labels match the live diagram (`initialChatFlow`, `kb.nodes.*`).
 */

const nodes: ReplaySample["nodes"] = [
  { id: "question", label: { vi: "Câu hỏi", en: "Question" }, sublabel: { vi: "của bạn", en: "yours" } },
  {
    id: "model-1",
    label: { vi: "Gemini chọn tool", en: "Gemini picks a tool" },
    sublabel: { vi: "function calling", en: "function calling" },
  },
  { id: "tool-1", label: { vi: "MCP tool", en: "MCP tool" }, sublabel: { vi: "chỉ đọc", en: "read-only" } },
  { id: "db-1", label: { vi: "Postgres", en: "Postgres" }, sublabel: { vi: "role chỉ đọc", en: "read-only role" } },
  { id: "answer", label: { vi: "Trả lời", en: "Answer" }, sublabel: { vi: "câu trả lời", en: "final answer" } },
];

const CALL = 'find_quotations {"order_by":"issue_date_desc","limit":1}';

export const placeholderSample: ReplaySample = {
  id: "latest-quotation-placeholder",
  title: { vi: "Báo giá mới nhất", en: "Latest quotation" },
  placeholder: true,
  input: {
    kind: "question",
    text: { vi: "Báo giá mới nhất có giá bao nhiêu?", en: "How much is the latest quotation?" },
  },
  nodes,
  steps: [
    { atMs: 0, nodeId: "question", status: "done" },
    { atMs: 0, nodeId: "model-1", status: "active" },
    {
      atMs: 1400,
      nodeId: "model-1",
      status: "done",
      detail: { vi: `${CALL} (minh hoạ)`, en: `${CALL} (illustrative)` },
    },
    { atMs: 1400, nodeId: "tool-1", status: "active" },
    { atMs: 1500, nodeId: "tool-1", status: "done", detail: { vi: "60 ms (minh hoạ)", en: "60 ms (illustrative)" } },
    {
      atMs: 1500,
      nodeId: "db-1",
      status: "done",
      detail: {
        vi: "1 dòng (minh hoạ)\nmột báo giá, ngày phát hành gần nhất",
        en: "1 row (illustrative)\none quotation, latest issue date",
      },
    },
    { atMs: 1500, nodeId: "answer", status: "active" },
    { atMs: 3600, nodeId: "answer", status: "done" },
  ],
  result: {
    kind: "text",
    text: {
      vi: "(minh hoạ) Bot gọi find_quotations để lấy báo giá có ngày phát hành gần nhất, rồi trả lời bằng tên công trình, mã báo giá và tổng tiền của báo giá đó lấy từ Postgres. Bản ghi của lần chạy thật chưa được gắn vào.",
      en: "(illustrative) The bot calls find_quotations to fetch the quotation with the latest issue date, then answers with that quotation's project name, number and total taken from Postgres. No record of a real run is attached yet.",
    },
  },
};

/** The recorded samples when there are any, otherwise the single placeholder. */
export function knowledgeBaseReplayFor(recorded: ReplaySample[]): ReplayDefinition {
  return { id: "knowledge-base", samples: recorded.length > 0 ? recorded : [placeholderSample] };
}

export const knowledgeBaseReplay: ReplayDefinition = knowledgeBaseReplayFor(recordedSamples);
