import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { giaPhaReplay } from "@/content/replays/gia-pha";
import type { ReplayDefinition, ReplaySample } from "@/content/replays/types";
import type { Locale } from "@/content/types";
import viMessages from "../../../messages/vi.json";
import enMessages from "../../../messages/en.json";
import { ReplayDemo } from "./ReplayDemo";
import { PageBadgeProvider } from "./DemoBadge";
import { demoComponents } from "./registry";

function imageSample(id: string, placeholder: boolean | undefined): ReplaySample {
  return {
    id,
    title: { vi: `Mẫu ${id}`, en: `Sample ${id}` },
    placeholder,
    input: {
      kind: "images",
      items: [{ src: "/replays/twistfit/model.svg", alt: { vi: `Ảnh vào ${id}`, en: `Input ${id}` } }],
    },
    nodes: [
      { id: "a", label: { vi: `Bước A ${id}`, en: `Step A ${id}` } },
      { id: "b", label: { vi: "Bước B", en: "Step B" } },
    ],
    steps: [
      { atMs: 0, nodeId: "a", status: "active" },
      { atMs: 100, nodeId: "a", status: "done" },
      { atMs: 200, nodeId: "b", status: "done", detail: { vi: "Kết thúc", en: "Finished" } },
    ],
    result: {
      kind: "images",
      items: [{ src: "/replays/twistfit/result-work.svg", alt: { vi: `Ảnh ra ${id}`, en: `Output ${id}` } }],
    },
  };
}

const definition: ReplayDefinition = {
  id: "test",
  samples: [imageSample("one", true), imageSample("two", false)],
};

function renderDemo(
  def: ReplayDefinition = definition,
  kind: "replay" | "simulation" = "replay",
  locale: Locale = "vi",
) {
  const utils = render(
    <NextIntlClientProvider locale={locale} messages={locale === "vi" ? viMessages : enMessages}>
      <ReplayDemo definition={def} kind={kind} locale={locale} />
    </NextIntlClientProvider>,
  );
  return utils;
}

function nodeStatus(container: HTMLElement, nodeId: string) {
  return container.querySelector(`[data-node-id='${nodeId}']`)?.getAttribute("data-status");
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("ReplayDemo", () => {
  it("shows the replay badge for kind=replay and the simulation badge for kind=simulation", () => {
    const { unmount } = renderDemo(definition, "replay");
    expect(screen.getByText("Phát lại từ lần chạy thật")).toBeInTheDocument();
    expect(screen.queryByText("Mô phỏng · tính năng đang phát triển")).toBeNull();
    unmount();
    renderDemo(definition, "simulation", "en");
    expect(screen.getByText("Simulation · feature in development")).toBeInTheDocument();
    expect(screen.queryByText("Replay of a real run")).toBeNull();
    expect(screen.queryByText("Live")).toBeNull();
  });

  it("does not auto-play: every node stays idle until Play is pressed", () => {
    const { container } = renderDemo();
    act(() => vi.advanceTimersByTime(5000));
    expect(nodeStatus(container, "a")).toBe("idle");
    expect(nodeStatus(container, "b")).toBe("idle");
    expect(screen.queryByAltText("Ảnh ra one")).toBeNull();
  });

  it("plays the flow, then shows the result and a Replay button", () => {
    const { container } = renderDemo();
    fireEvent.click(screen.getByRole("button", { name: "Chạy" }));
    act(() => vi.advanceTimersByTime(0));
    expect(nodeStatus(container, "a")).toBe("active");
    expect(screen.queryByAltText("Ảnh ra one")).toBeNull();
    act(() => vi.advanceTimersByTime(300));
    expect(nodeStatus(container, "b")).toBe("done");
    expect(screen.getByAltText("Ảnh ra one")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Phát lại" })).toBeEnabled();
  });

  it("shows the placeholder ribbon on input and result images iff placeholder is true", () => {
    renderDemo();
    // Sample "one" is a placeholder: ribbon on the input image now, and on the result later.
    expect(screen.getAllByText("ảnh giữ chỗ")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Chạy" }));
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getAllByText("ảnh giữ chỗ")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Mẫu two" }));
    expect(screen.queryByText("ảnh giữ chỗ")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Chạy" }));
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByAltText("Ảnh ra two")).toBeInTheDocument();
    expect(screen.queryByText("ảnh giữ chỗ")).toBeNull();
  });

  it("qualifies the badge only while the current sample is a placeholder", () => {
    renderDemo();
    expect(screen.getByText("Phát lại từ lần chạy thật")).toBeInTheDocument();
    expect(screen.getByText("Ảnh và dữ kiện giữ chỗ")).toBeInTheDocument();
    expect(
      screen.getByText("Mẫu giữ chỗ: chưa có bản ghi của lần chạy thật nào được gắn vào."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mẫu two" }));
    expect(screen.getByText("Phát lại từ lần chạy thật")).toBeInTheDocument();
    expect(screen.queryByText("Ảnh và dữ kiện giữ chỗ")).toBeNull();
    expect(screen.queryByText(/Mẫu giữ chỗ/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Mẫu one" }));
    expect(screen.getByText("Ảnh và dữ kiện giữ chỗ")).toBeInTheDocument();
  });

  it("does not qualify the simulation badge (no placeholder samples)", () => {
    renderDemo(giaPhaReplay, "simulation", "en");
    expect(screen.getByText("Simulation · feature in development")).toBeInTheDocument();
    expect(screen.queryByText("Placeholder images and facts")).toBeNull();
  });

  it("shows the English ribbon text in en", () => {
    renderDemo(definition, "replay", "en");
    expect(screen.getByText("placeholder images")).toBeInTheDocument();
  });

  it("sample picker marks the pressed sample, switches samples and resets the flow", () => {
    const { container } = renderDemo();
    const group = screen.getByRole("group", { name: "Chọn mẫu" });
    const one = within(group).getByRole("button", { name: "Mẫu one" });
    const two = within(group).getByRole("button", { name: "Mẫu two" });
    expect(one).toHaveAttribute("aria-pressed", "true");
    expect(two).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByRole("button", { name: "Chạy" }));
    act(() => vi.advanceTimersByTime(150));
    expect(nodeStatus(container, "a")).toBe("done");

    // Native buttons: focusable and activated by Enter/Space in the browser.
    expect(two.tagName).toBe("BUTTON");
    expect(two).toHaveAttribute("type", "button");
    expect(two).not.toHaveAttribute("tabindex", "-1");
    fireEvent.click(two);
    expect(two).toHaveAttribute("aria-pressed", "true");
    expect(one).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Bước A two")).toBeInTheDocument();
    expect(nodeStatus(container, "a")).toBe("idle");
    expect(screen.getByAltText("Ảnh vào two")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1000));
    expect(nodeStatus(container, "b")).toBe("idle");
    expect(screen.queryByAltText("Ảnh ra two")).toBeNull();
  });

  it("under reduced motion, Play shows the final state immediately", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("reduce"),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        onchange: null,
        dispatchEvent: () => false,
      })),
    );
    const { container } = renderDemo();
    fireEvent.click(screen.getByRole("button", { name: "Chạy" }));
    expect(nodeStatus(container, "b")).toBe("done");
    expect(screen.getByAltText("Ảnh ra one")).toBeInTheDocument();
  });

  it("unmounting mid-play leaves no pending timers or act warnings", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { unmount } = renderDemo();
    fireEvent.click(screen.getByRole("button", { name: "Chạy" }));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(1000);
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});

describe("Gia phả simulation", () => {
  const sample = giaPhaReplay.samples[0];

  it("shows the fake file as a document card with its name and excerpt", () => {
    renderDemo(giaPhaReplay, "simulation");
    if (sample.input.kind !== "file") throw new Error("expected a file input");
    expect(screen.getByText(sample.input.fileName)).toBeInTheDocument();
    for (const line of sample.input.excerpt.vi) expect(screen.getByText(line)).toBeInTheDocument();
  });

  it("lists every person from the excerpt with their parents after the run", () => {
    const { container } = renderDemo(giaPhaReplay, "simulation");
    if (sample.result.kind !== "people") throw new Error("expected people");
    fireEvent.click(screen.getByRole("button", { name: "Chạy" }));
    act(() => vi.advanceTimersByTime(60_000));
    const people = sample.result.people;
    const byId = new Map(people.map((p) => [p.id, p]));
    for (const person of people) {
      const item = container.querySelector<HTMLElement>(`[data-person-id='${person.id}']`);
      expect(item, person.name).not.toBeNull();
      expect(item!.textContent).toContain(person.name);
      for (const parentId of person.parentIds) {
        expect(item!.textContent).toContain(byId.get(parentId)!.name);
      }
    }
  });

  it("says photos and scans are planned, in both languages", () => {
    const { unmount } = render(
      <NextIntlClientProvider locale="vi" messages={viMessages}>
        {(() => {
          const Demo = demoComponents["gia-pha-simulation"];
          return <Demo locale="vi" />;
        })()}
      </NextIntlClientProvider>,
    );
    expect(screen.getByText(/ảnh chụp.*scan.*kế hoạch/i)).toBeInTheDocument();
    expect(screen.getByText("Mô phỏng · tính năng đang phát triển")).toBeInTheDocument();
    unmount();
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        {(() => {
          const Demo = demoComponents["gia-pha-simulation"];
          return <Demo locale="en" />;
        })()}
      </NextIntlClientProvider>,
    );
    expect(screen.getByText(/photos.*scans.*planned/i)).toBeInTheDocument();
  });
});

describe("demo registry", () => {
  it("has all three demo keys", () => {
    expect(Object.keys(demoComponents).sort()).toEqual(
      ["gia-pha-simulation", "knowledge-base", "twistfit-replay"].sort(),
    );
  });

  it("the Twistfit demo shows the replay badge and placeholder ribbon", () => {
    const Demo = demoComponents["twistfit-replay"];
    render(
      <NextIntlClientProvider locale="vi" messages={viMessages}>
        <Demo locale="vi" />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("Phát lại từ lần chạy thật")).toBeInTheDocument();
    expect(screen.getAllByText("ảnh giữ chỗ").length).toBeGreaterThan(0);
  });

  it("under a page-level badge, shows no second label but keeps the placeholder qualifier", () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <PageBadgeProvider>
          <ReplayDemo definition={definition} kind="replay" locale="en" />
        </PageBadgeProvider>
      </NextIntlClientProvider>,
    );
    expect(screen.queryByText("Replay of a real run")).toBeNull();
    expect(screen.getByText("Placeholder images and facts")).toBeInTheDocument();
    expect(screen.getByText("Placeholder sample: no record of a real run is attached yet.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sample two" }));
    expect(screen.queryByText("Placeholder images and facts")).toBeNull();
  });
});
