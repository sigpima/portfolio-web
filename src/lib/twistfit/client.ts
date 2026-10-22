import { parseCatalog, parseJobStatus, TWISTFIT_ID, type JobStatus, type TwistfitCatalog } from "./types";

/**
 * A failed Twistfit call. `code` is the server's JSON code (`invite_required`, `busy`,
 * `twistfit_limit`, `invalid_request`, `not_found`, `too_long`, `demo_disabled`), or one set
 * here: `network` (no answer), `invalid_response` (unexpected body), `client_timeout`
 * (polling budget spent), `internal` (error body without a code). `status` is 0 when there
 * was no HTTP answer.
 */
export class TwistfitError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status = 0) {
    super(`twistfit request failed: ${status} ${code}`);
    this.name = "TwistfitError";
    this.code = code;
    this.status = status;
  }
}

const DEFAULT_INTERVAL_MS = 1500;
const DEFAULT_MAX_MS = 120_000;
/** Consecutive network failures tolerated while polling before giving up. */
const MAX_NETWORK_FAILURES = 3;

function isAbortError(err: unknown): boolean {
  return (err instanceof Error || err instanceof DOMException) && err.name === "AbortError";
}

function abortError(): DOMException {
  return new DOMException("The operation was aborted.", "AbortError");
}

async function errorCode(res: Response): Promise<string> {
  // A 401 always means the invite no longer works, whatever the body says.
  if (res.status === 401) return "invite_required";
  try {
    const body: unknown = await res.json();
    if (body && typeof body === "object" && "code" in body && typeof body.code === "string") {
      return body.code;
    }
  } catch {
    // fall through
  }
  return "internal";
}

/** `fetch` that turns HTTP errors and network failures into `TwistfitError`, aborts aside. */
async function request(url: string, init: RequestInit): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { credentials: "same-origin", cache: "no-store", ...init });
  } catch (err) {
    if (isAbortError(err) || init.signal?.aborted) throw err;
    throw new TwistfitError("network", 0);
  }
  if (!res.ok) throw new TwistfitError(await errorCode(res), res.status);
  try {
    return await res.json();
  } catch (err) {
    if (isAbortError(err) || init.signal?.aborted) throw err;
    throw new TwistfitError("invalid_response", res.status);
  }
}

export function assetUrl(kind: "models" | "items", id: string): string {
  return `/api/twistfit/assets/${kind}/${encodeURIComponent(id)}`;
}

export function resultUrl(resultId: string): string {
  return `/api/twistfit/results/${encodeURIComponent(resultId)}`;
}

export async function fetchCatalog(signal?: AbortSignal): Promise<TwistfitCatalog> {
  const body = await request("/api/twistfit/catalog", { signal });
  const catalog = parseCatalog(body);
  if (!catalog) throw new TwistfitError("invalid_response", 200);
  return catalog;
}

export async function startRun(
  input: { items: string[]; model: string },
  signal?: AbortSignal,
): Promise<{ jobId: string }> {
  const body = await request("/api/twistfit/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: input.items, model: input.model }),
    signal,
  });
  const jobId = body && typeof body === "object" && "job_id" in body ? body.job_id : undefined;
  if (typeof jobId !== "string" || !TWISTFIT_ID.test(jobId)) throw new TwistfitError("invalid_response", 202);
  return { jobId };
}

/** Resolves after `ms`, or rejects with an AbortError as soon as `signal` aborts. */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError());
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Poll a job every `intervalMs` (first poll right away) until it is `done` or `error`, and
 * resolve with that last status; `onUpdate` sees every status. Rejects with an AbortError
 * when `signal` aborts, with `TwistfitError("client_timeout")` once `maxMs` has passed, and
 * with the mapped `TwistfitError` on an HTTP error (401 -> `invite_required`). A few
 * consecutive network failures are ridden out.
 */
export async function pollJob(
  jobId: string,
  opts: {
    onUpdate(s: JobStatus): void;
    signal: AbortSignal;
    intervalMs?: number;
    maxMs?: number;
  },
): Promise<JobStatus> {
  const { onUpdate, signal } = opts;
  const intervalMs = opts.intervalMs ?? DEFAULT_INTERVAL_MS;
  const maxMs = opts.maxMs ?? DEFAULT_MAX_MS;
  const deadline = Date.now() + maxMs;
  const url = `/api/twistfit/jobs/${encodeURIComponent(jobId)}`;
  let networkFailures = 0;

  for (;;) {
    if (signal.aborted) throw abortError();
    let status: JobStatus | null = null;
    try {
      status = parseJobStatus(await request(url, { signal }));
      networkFailures = 0;
      if (!status) throw new TwistfitError("invalid_response", 200);
    } catch (err) {
      if (signal.aborted) throw abortError();
      if (!(err instanceof TwistfitError && err.code === "network")) throw err;
      networkFailures += 1;
      if (networkFailures >= MAX_NETWORK_FAILURES) throw err;
    }
    if (status) {
      onUpdate(status);
      if (status.status !== "running") return status;
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new TwistfitError("client_timeout", 0);
    await sleep(Math.min(intervalMs, remaining), signal);
    if (Date.now() >= deadline) throw new TwistfitError("client_timeout", 0);
  }
}
