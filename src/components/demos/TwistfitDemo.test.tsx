import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Locale } from "@/content/types";
import { fetchCatalog, pollJob, startRun, TwistfitError } from "@/lib/twistfit/client";
import type { JobStatus, TwistfitCatalog } from "@/lib/twistfit/types";
import viMessages from "../../../messages/vi.json";
import enMessages from "../../../messages/en.json";
import { TwistfitDemo } from "./TwistfitDemo";

vi.mock("@/lib/twistfit/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/twistfit/client")>();
  return { ...actual, fetchCatalog: vi.fn(), startRun: vi.fn(), pollJob: vi.fn() };
});

const mockCatalog = vi.mocked(fetchCatalog);
const mockStart = vi.mocked(startRun);
const mockPoll = vi.mocked(pollJob);

const L = { vi: viMessages.twistfit.live, en: enMessages.twistfit.live };

const CATALOG: TwistfitCatalog = {
  max_items: 3,
  models: [
    { id: "m1", name: { vi: "Lan", en: "Lan" } },
    { id: "m2", name: { vi: "Mai", en: "Mai" } },
  ],
  items: [
    { id: "ao", name: { vi: "Áo sơ mi", en: "Shirt" } },
    { id: "quan", name: { vi: "Quần jean", en: "Jeans" } },
    { id: "vay", name: { vi: "Váy", en: "Skirt" } },
    { id: "mu", name: { vi: "Mũ", en: "Hat" } },
  ],
};

type PollOpts = Parameters<typeof pollJob>[1];

/** A `pollJob` the test drives: push updates, then finish or fail. */
function controlledPoll() {
  let opts: PollOpts | null = null;
  let resolve: ((s: JobStatus) => void) | null = null;
  let reject: ((e: unknown) => void) | null = null;
  mockPoll.mockImplementation((_id, o) => {
    opts = o;
    return new Promise<JobStatus>((res, rej) => {
      resolve = res;
      reject = rej;
      o.signal.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError")));
    });
  });
  const started = () => waitFor(() => expect(opts).not.toBeNull());
  return {
    started,
    get signal() {
      return opts!.signal;
    },
    update: async (s: JobStatus) => {
      await started();
      act(() => opts!.onUpdate(s));
    },
    finish: async (s: JobStatus) => {
      await started();
      await act(async () => {
        opts!.onUpdate(s);
        resolve!(s);
      });
    },
    fail: async (e: unknown) => {
      await started();
      await act(async () => reject!(e));
    },
  };
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function renderDemo(locale: Locale = "vi", onInviteRequired = vi.fn()) {
  const user = userEvent.setup();
  const messages = locale === "vi" ? viMessages : enMessages;
  const utils = render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <TwistfitDemo locale={locale} onInviteRequired={onInviteRequired} />
    </NextIntlClientProvider>,
  );
  return { user, onInviteRequired, ...utils };
}

function currentStep() {
  const steps = within(screen.getByRole("list", { name: L.vi.stepsLabel })).getAllByRole("listitem");
  return steps.findIndex((li) => li.getAttribute("aria-current") === "step") + 1;
}

function button(name: string) {
  return screen.getByRole("button", { name });
}

async function toStep3(user: ReturnType<typeof userEvent.setup>, locale: Locale = "vi") {
  const items = locale === "vi" ? ["Áo sơ mi", "Quần jean"] : ["Shirt", "Jeans"];
  for (const name of items) await user.click(await screen.findByRole("checkbox", { name }));
  await user.click(button(L[locale].next));
  await user.click(screen.getByRole("radio", { name: "Lan" }));
  await user.click(button(L[locale].next));
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  mockCatalog.mockReset().mockResolvedValue(CATALOG);
  mockStart.mockReset().mockResolvedValue({ jobId: "job_1" });
  mockPoll.mockReset();
  consoleError = vi.spyOn(console, "error");
});

afterEach(() => {
  expect(consoleError).not.toHaveBeenCalled();
  consoleError.mockRestore();
});

describe("TwistfitDemo", () => {
  it("walks through the three steps to the result image", async () => {
    const poll = controlledPoll();
    const { user } = renderDemo();

    expect(screen.getByText(L.vi.loading)).toBeInTheDocument();
    const shirt = await screen.findByRole("checkbox", { name: "Áo sơ mi" });
    expect(currentStep()).toBe(1);
    expect(screen.getByRole("img", { name: "Áo sơ mi" })).toHaveAttribute("src", "/api/twistfit/assets/items/ao");

    await user.click(shirt);
    await user.click(screen.getByRole("checkbox", { name: "Quần jean" }));
    expect(screen.getByRole("status")).toHaveTextContent("Đã chọn 2/3");
    await user.click(button(L.vi.next));

    expect(currentStep()).toBe(2);
    const group = screen.getByRole("radiogroup");
    expect(within(group).getAllByRole("radio")).toHaveLength(2);
    expect(screen.getByRole("img", { name: "Mai" })).toHaveAttribute("src", "/api/twistfit/assets/models/m2");
    await user.click(screen.getByRole("radio", { name: "Lan" }));
    await user.click(button(L.vi.next));

    expect(currentStep()).toBe(3);
    const summary = screen.getByRole("region", { name: L.vi.steps.generate });
    expect(summary).toHaveTextContent("Áo sơ mi");
    expect(summary).toHaveTextContent("Quần jean");
    expect(summary).toHaveTextContent("Lan");

    await user.click(button(L.vi.generate));
    expect(mockStart).toHaveBeenCalledWith({ items: ["ao", "quan"], model: "m1" }, expect.any(AbortSignal));
    await poll.update({ status: "running", stage: "merging", elapsed_seconds: 0 });
    expect(screen.getByRole("status")).toHaveTextContent(L.vi.stages.merging);
    expect(mockPoll).toHaveBeenCalledWith("job_1", expect.objectContaining({ signal: expect.any(AbortSignal) }));

    await poll.finish({ status: "done", stage: "downloading", elapsed_seconds: 30, result_id: "r_1" });
    const img = await screen.findByRole("img", { name: "Người mẫu Lan mặc: Áo sơ mi, Quần jean" });
    expect(img).toHaveAttribute("src", "/api/twistfit/results/r_1");
    const heading = screen.getByRole("heading", { name: L.vi.result.title });
    expect(heading).toHaveFocus();
    const download = screen.getByRole("link", { name: L.vi.download });
    expect(download).toHaveAttribute("href", "/api/twistfit/results/r_1");
    expect(download).toHaveAttribute("download");
  });

  it("uses the English names and copy under en", async () => {
    const poll = controlledPoll();
    const { user } = renderDemo("en");
    await toStep3(user, "en");
    await user.click(button(L.en.generate));
    await poll.finish({ status: "done", stage: "downloading", elapsed_seconds: 30, result_id: "r_1" });
    expect(await screen.findByRole("img", { name: "Model Lan wearing: Shirt, Jeans" })).toBeInTheDocument();
  });

  it("never lets more than max_items be picked", async () => {
    const { user } = renderDemo();
    await user.click(await screen.findByRole("checkbox", { name: "Áo sơ mi" }));
    await user.click(screen.getByRole("checkbox", { name: "Quần jean" }));
    await user.click(screen.getByRole("checkbox", { name: "Váy" }));
    expect(screen.getByRole("status")).toHaveTextContent("Đã chọn 3/3");
    const hat = screen.getByRole("checkbox", { name: "Mũ" });
    expect(hat).toBeDisabled();
    await user.click(hat);
    expect(hat).not.toBeChecked();

    await user.click(screen.getByRole("checkbox", { name: "Váy" }));
    expect(hat).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent("Đã chọn 2/3");
  });

  it("enables Continue only once the step is valid, and goes back keeping the choices", async () => {
    const { user } = renderDemo();
    const shirt = await screen.findByRole("checkbox", { name: "Áo sơ mi" });
    expect(button(L.vi.next)).toBeDisabled();
    await user.click(shirt);
    expect(button(L.vi.next)).toBeEnabled();
    await user.click(shirt);
    expect(button(L.vi.next)).toBeDisabled();
    await user.click(shirt);
    await user.click(button(L.vi.next));

    expect(screen.getByRole("radio", { name: "Lan" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Mai" })).not.toBeChecked();
    expect(button(L.vi.next)).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: "Mai" }));
    expect(button(L.vi.next)).toBeEnabled();

    await user.click(button(L.vi.back));
    expect(currentStep()).toBe(1);
    expect(screen.getByRole("checkbox", { name: "Áo sơ mi" })).toBeChecked();
    await user.click(button(L.vi.next));
    expect(screen.getByRole("radio", { name: "Mai" })).toBeChecked();
  });

  it("moves focus to the new step's heading when changing steps", async () => {
    const { user } = renderDemo();
    await user.click(await screen.findByRole("checkbox", { name: "Áo sơ mi" }));
    await user.click(button(L.vi.next));
    expect(screen.getByRole("heading", { name: L.vi.steps.model })).toHaveFocus();
  });

  it("starts a single run when Generate is clicked twice", async () => {
    controlledPoll();
    const start = deferred<{ jobId: string }>();
    mockStart.mockReturnValue(start.promise);
    const { user } = renderDemo();
    await toStep3(user);
    const generate = button(L.vi.generate);
    await user.dblClick(generate);
    await user.click(generate);
    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(generate).toBeDisabled();
    expect(button(L.vi.back)).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(L.vi.stages.starting);
    await act(async () => start.resolve({ jobId: "job_1" }));
  });

  it("changes the stage sentence and seconds without moving focus", async () => {
    const poll = controlledPoll();
    const { user } = renderDemo();
    await toStep3(user);
    await user.click(button(L.vi.generate));
    await poll.update({ status: "running", stage: "merging", elapsed_seconds: 0 });
    const focused = document.activeElement;

    await poll.update({ status: "running", stage: "waiting", elapsed_seconds: 12 });
    expect(screen.getByRole("status")).toHaveTextContent(L.vi.stages.waiting);
    expect(screen.getByText("12 giây")).toBeInTheDocument();
    expect(document.activeElement).toBe(focused);

    await poll.update({ status: "running", stage: "waiting", elapsed_seconds: 14 });
    expect(screen.getByText("14 giây")).toBeInTheDocument();
    await poll.update({ status: "running", stage: "downloading", elapsed_seconds: 30 });
    expect(screen.getByRole("status")).toHaveTextContent(L.vi.stages.downloading);
    expect(document.activeElement).toBe(focused);
  });

  it("keeps the ticking seconds out of the live region", async () => {
    const poll = controlledPoll();
    const { user } = renderDemo();
    await toStep3(user);
    await user.click(button(L.vi.generate));
    await poll.update({ status: "running", stage: "waiting", elapsed_seconds: 12 });
    expect(screen.getByRole("status")).not.toHaveTextContent("12");
  });

  describe.each(["vi", "en"] as const)("errors (%s)", (locale) => {
    const t = L[locale];

    it.each([
      ["busy", "busy"],
      ["twistfit_limit", "limit"],
      ["invalid_request", "generic"],
      ["demo_disabled", "generic"],
    ] as const)("shows the %s run rejection as errors.%s", async (code, key) => {
      controlledPoll();
      mockStart.mockRejectedValue(new TwistfitError(code, 429));
      const { user } = renderDemo(locale);
      await toStep3(user, locale);
      await user.click(button(t.generate));
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(t.errors[key]);
      expect(alert).not.toHaveTextContent(code);
      expect(within(alert).getByText(t.errors[key])).toHaveFocus();
    });

    it.each([
      ["flux_moderated", "moderated"],
      ["flux_timeout", "timeout"],
      ["flux_failed", "generic"],
      ["flux_unavailable", "generic"],
      ["cancelled", "generic"],
    ] as const)("shows the job error %s as errors.%s", async (code, key) => {
      const poll = controlledPoll();
      const { user } = renderDemo(locale);
      await toStep3(user, locale);
      await user.click(button(t.generate));
      await poll.finish({ status: "error", stage: "waiting", elapsed_seconds: 5, code });
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(t.errors[key]);
      expect(alert).not.toHaveTextContent(code);
    });

    it.each([
      ["client_timeout", 0],
      ["not_found", 404],
      ["network", 0],
    ] as const)("shows a %s polling failure as errors.generic", async (code, status) => {
      const poll = controlledPoll();
      const { user } = renderDemo(locale);
      await toStep3(user, locale);
      await user.click(button(t.generate));
      await poll.fail(new TwistfitError(code, status));
      expect(await screen.findByRole("alert")).toHaveTextContent(t.errors.generic);
    });
  });

  it("offers Try again after a failure, which starts a new run", async () => {
    controlledPoll();
    mockStart.mockRejectedValueOnce(new TwistfitError("busy", 429));
    const { user } = renderDemo();
    await toStep3(user);
    await user.click(button(L.vi.generate));
    const alert = await screen.findByRole("alert");
    await user.click(within(alert).getByRole("button", { name: L.vi.retry }));
    expect(mockStart).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("does not offer Try again once the link has no generations left", async () => {
    mockStart.mockRejectedValue(new TwistfitError("twistfit_limit", 429));
    const { user } = renderDemo();
    await toStep3(user);
    await user.click(button(L.vi.generate));
    const alert = await screen.findByRole("alert");
    expect(within(alert).queryByRole("button")).not.toBeInTheDocument();
  });

  it("calls onInviteRequired when the run says the invite is gone", async () => {
    mockStart.mockRejectedValue(new TwistfitError("invite_required", 401));
    const { user, onInviteRequired } = renderDemo();
    await toStep3(user);
    await user.click(button(L.vi.generate));
    await waitFor(() => expect(onInviteRequired).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("alert")).toHaveTextContent(L.vi.errors.inviteRequired);
  });

  it("calls onInviteRequired when polling says the invite is gone", async () => {
    const poll = controlledPoll();
    const { user, onInviteRequired } = renderDemo();
    await toStep3(user);
    await user.click(button(L.vi.generate));
    await poll.fail(new TwistfitError("invite_required", 401));
    await waitFor(() => expect(onInviteRequired).toHaveBeenCalledTimes(1));
  });

  it("calls onInviteRequired when the catalog says the invite is gone", async () => {
    mockCatalog.mockRejectedValue(new TwistfitError("invite_required", 401));
    const { onInviteRequired } = renderDemo();
    await waitFor(() => expect(onInviteRequired).toHaveBeenCalledTimes(1));
  });

  it("shows a calm message with a retry when the catalog cannot load", async () => {
    mockCatalog.mockRejectedValueOnce(new TwistfitError("demo_disabled", 503));
    const { user, onInviteRequired } = renderDemo();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(L.vi.unavailable);
    await user.click(within(alert).getByRole("button", { name: L.vi.retry }));
    expect(await screen.findByRole("checkbox", { name: "Áo sơ mi" })).toBeInTheDocument();
    expect(mockCatalog).toHaveBeenCalledTimes(2);
    expect(onInviteRequired).not.toHaveBeenCalled();
  });

  it("aborts the catalog request on unmount", async () => {
    const pending = deferred<TwistfitCatalog>();
    mockCatalog.mockReturnValue(pending.promise);
    const { unmount } = renderDemo();
    const signal = mockCatalog.mock.calls[0][0]!;
    unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => pending.resolve(CATALOG));
  });

  it("does not poll after an unmount while the run is starting", async () => {
    controlledPoll();
    const start = deferred<{ jobId: string }>();
    mockStart.mockReturnValue(start.promise);
    const { user, unmount, onInviteRequired } = renderDemo();
    await toStep3(user);
    await user.click(button(L.vi.generate));
    const signal = mockStart.mock.calls[0][1]!;
    unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => start.resolve({ jobId: "job_1" }));
    expect(mockPoll).not.toHaveBeenCalled();
    expect(onInviteRequired).not.toHaveBeenCalled();
  });

  it("aborts polling on unmount without reporting an error", async () => {
    const poll = controlledPoll();
    const { user, unmount } = renderDemo();
    await toStep3(user);
    await user.click(button(L.vi.generate));
    await poll.update({ status: "running", stage: "waiting", elapsed_seconds: 3 });
    unmount();
    expect(poll.signal.aborted).toBe(true);
    await act(async () => {});
  });

  it("Make another goes back to step 1 keeping the choices", async () => {
    const poll = controlledPoll();
    const { user } = renderDemo();
    await toStep3(user);
    await user.click(button(L.vi.generate));
    await poll.finish({ status: "done", stage: "downloading", elapsed_seconds: 30, result_id: "r_1" });
    await user.click(await screen.findByRole("button", { name: L.vi.regenerate }));
    expect(currentStep()).toBe(1);
    expect(screen.getByRole("checkbox", { name: "Áo sơ mi" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Quần jean" })).toBeChecked();
    await user.click(button(L.vi.next));
    expect(screen.getByRole("radio", { name: "Lan" })).toBeChecked();
    await user.click(button(L.vi.next));
    expect(screen.queryByRole("img", { name: /Người mẫu Lan/ })).not.toBeInTheDocument();
    expect(button(L.vi.generate)).toBeEnabled();
  });

  it.each(["vi", "en"] as const)("always shows the honesty notes (%s)", async (locale) => {
    renderDemo(locale);
    for (const note of Object.values(L[locale].notes)) expect(screen.getByText(note)).toBeInTheDocument();
    await screen.findByRole("checkbox", { name: locale === "vi" ? "Áo sơ mi" : "Shirt" });
    for (const note of Object.values(L[locale].notes)) expect(screen.getByText(note)).toBeInTheDocument();
  });
});
