/** One model or item of the Twistfit catalog, as `GET /api/twistfit/catalog` lists it. */
export type CatalogEntry = { id: string; name: Record<"vi" | "en", string> };

export type TwistfitCatalog = { max_items: number; models: CatalogEntry[]; items: CatalogEntry[] };

export type JobStage = "merging" | "waiting" | "downloading";

export type JobStatus = {
  status: "running" | "done" | "error";
  stage?: JobStage;
  elapsed_seconds: number;
  result_id?: string;
  code?: string;
};

/** Shape of every id the API issues or the catalog holds (mirrors the web proxy). */
export const TWISTFIT_ID = /^[A-Za-z0-9_-]{1,64}$/;
/** Error codes are short system identifiers; anything else is not relayed to the UI. */
const CODE_SHAPE = /^[a-z_]{1,64}$/;

/** Generous caps: the API allows 6 models and 12 items, 3 per run. */
const MAX_ENTRIES = 100;
const MAX_ITEMS_PER_RUN = 10;
const MAX_NAME_CHARS = 200;

const STATUSES: ReadonlySet<string> = new Set(["running", "done", "error"]);
const STAGES: ReadonlySet<string> = new Set(["merging", "waiting", "downloading"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isName(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "" && value.length <= MAX_NAME_CHARS;
}

function parseEntries(value: unknown): CatalogEntry[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_ENTRIES) return null;
  const out: CatalogEntry[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (!isRecord(raw) || typeof raw.id !== "string" || !TWISTFIT_ID.test(raw.id) || seen.has(raw.id)) {
      return null;
    }
    const name = raw.name;
    if (!isRecord(name) || !isName(name.vi) || !isName(name.en)) return null;
    seen.add(raw.id);
    // Copy only the known fields.
    out.push({ id: raw.id, name: { vi: name.vi, en: name.en } });
  }
  return out;
}

/** The catalog, or null when the value does not have the expected shape. */
export function parseCatalog(value: unknown): TwistfitCatalog | null {
  if (!isRecord(value)) return null;
  const max = value.max_items;
  if (typeof max !== "number" || !Number.isInteger(max) || max < 1 || max > MAX_ITEMS_PER_RUN) return null;
  const models = parseEntries(value.models);
  const items = parseEntries(value.items);
  if (!models || !items) return null;
  return { max_items: max, models, items };
}

/** A job status, or null when the value does not have the expected shape. */
export function parseJobStatus(value: unknown): JobStatus | null {
  if (!isRecord(value)) return null;
  const { status, stage, elapsed_seconds: elapsed, result_id: resultId, code } = value;
  if (typeof status !== "string" || !STATUSES.has(status)) return null;
  if (typeof elapsed !== "number" || !Number.isFinite(elapsed) || elapsed < 0) return null;
  if (stage !== undefined && stage !== null && (typeof stage !== "string" || !STAGES.has(stage))) return null;
  if (resultId !== undefined && (typeof resultId !== "string" || !TWISTFIT_ID.test(resultId))) return null;
  if (code !== undefined && (typeof code !== "string" || !CODE_SHAPE.test(code))) return null;
  if (status === "done" && resultId === undefined) return null;
  if (status === "error" && code === undefined) return null;

  const out: JobStatus = { status: status as JobStatus["status"], elapsed_seconds: elapsed };
  if (typeof stage === "string") out.stage = stage as JobStage;
  if (status === "done") out.result_id = resultId as string;
  if (status === "error") out.code = code as string;
  return out;
}
