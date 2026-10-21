import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { FlowState, NodeStatus } from "@/lib/flow/model";
import { FlowPlayer } from "./FlowPlayer";

const statusLabels: Record<NodeStatus, string> = {
  idle: "Chờ",
  active: "Đang chạy",
  done: "Xong",
  error: "Lỗi",
  skipped: "Bỏ qua",
};

const JSON_DETAIL = '{\n  "hạng_mục": "chống thấm",\n  "đơn_giá": 1240000\n}';

const state: FlowState = {
  rows: [
    {
      id: "main",
      nodes: [
        { id: "ask", label: "Câu hỏi", sublabel: "tiếng Việt", status: "done", detail: "Báo giá mới nhất có giá bao nhiêu?" },
        { id: "think", label: "Gemini chọn tool", status: "active", detail: "Cần: báo giá → find_quotations" },
        { id: "tool", label: "find_quotations", status: "done", detail: JSON_DETAIL },
        { id: "db", label: "Postgres", status: "error", detail: "connection refused" },
        { id: "answer", label: "Diễn giải", status: "idle" },
        { id: "extra", label: "Bước phụ", status: "skipped" },
      ],
    },
    {
      id: "second",
      title: "Lần gọi tool thứ 2",
      nodes: [{ id: "tool2", label: "get_item", status: "idle" }],
    },
  ],
};

function renderPlayer(s: FlowState = state) {
  return render(<FlowPlayer state={s} label="Luồng suy luận của bot" statusLabels={statusLabels} />);
}

function node(id: string) {
  const el = document.querySelector(`li[data-node-id="${id}"]`);
  if (!el) throw new Error(`node ${id} missing`);
  return el as HTMLElement;
}

describe("FlowPlayer", () => {
  it("labels the wrapper with the label prop", () => {
    renderPlayer();
    expect(screen.getByLabelText("Luồng suy luận của bot")).toBeInTheDocument();
  });

  it("renders every node label and sublabel", () => {
    renderPlayer();
    for (const row of state.rows) {
      for (const n of row.nodes) expect(screen.getByText(n.label)).toBeInTheDocument();
    }
    expect(screen.getByText("tiếng Việt")).toBeInTheDocument();
  });

  it("renders each row as an ordered list of list items", () => {
    renderPlayer();
    const lists = screen.getAllByRole("list");
    expect(lists).toHaveLength(2);
    expect(within(lists[0]).getAllByRole("listitem")).toHaveLength(6);
    expect(within(lists[1]).getAllByRole("listitem")).toHaveLength(1);
    expect(lists[0].tagName).toBe("OL");
  });

  it("exposes status through data-status", () => {
    renderPlayer();
    expect(node("ask")).toHaveAttribute("data-status", "done");
    expect(node("think")).toHaveAttribute("data-status", "active");
    expect(node("db")).toHaveAttribute("data-status", "error");
    expect(node("answer")).toHaveAttribute("data-status", "idle");
    expect(node("extra")).toHaveAttribute("data-status", "skipped");
  });

  it("includes status text for screen readers on every node, not only color", () => {
    renderPlayer();
    expect(within(node("db")).getByText("Lỗi")).toBeInTheDocument();
    expect(within(node("think")).getByText("Đang chạy")).toBeInTheDocument();
    expect(within(node("ask")).getByText("Xong")).toBeInTheDocument();
    expect(within(node("answer")).getByText("Chờ")).toBeInTheDocument();
    expect(within(node("extra")).getByText("Bỏ qua")).toBeInTheDocument();
    expect(within(node("db")).getByText("Lỗi")).toHaveClass("sr-only");
  });

  it("renders detail text verbatim, keeping Vietnamese diacritics and newlines", () => {
    renderPlayer();
    const pre = within(node("tool")).getByText(/hạng_mục/, { selector: "pre" });
    expect(pre.tagName).toBe("PRE");
    expect(pre.textContent).toBe(JSON_DETAIL);
    expect(within(node("ask")).getByText("Báo giá mới nhất có giá bao nhiêu?").tagName).toBe("PRE");
  });

  it("bounds the detail box and makes the scrolling region focusable and named", () => {
    renderPlayer();
    const pre = node("tool").querySelector("pre") as HTMLElement;
    expect(pre).toHaveAttribute("tabindex", "0");
    expect(pre).toHaveAttribute("role", "group");
    expect(pre).not.toHaveAttribute("aria-label");
    expect(pre).toHaveAccessibleName("find_quotations");
    expect(screen.queryAllByRole("region")).toHaveLength(1); // only the wrapper section is a landmark
    expect(pre.className).toMatch(/overflow-auto/);
    expect(pre.className).toMatch(/max-h-/);
    expect(pre.className).toMatch(/break-words|wrap-/);
    expect(pre.className).toMatch(/whitespace-pre-wrap/);
  });

  it("names each detail group by its node label only, with unique ids across instances", () => {
    const { container } = render(
      <>
        <FlowPlayer state={state} label="A" statusLabels={statusLabels} />
        <FlowPlayer state={state} label="B" statusLabels={statusLabels} />
      </>,
    );
    const ids = [...container.querySelectorAll("[id]")].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const pre of container.querySelectorAll("pre")) {
      const name = pre.closest("li")!.querySelector("[id$='-label']")!.textContent;
      expect(pre).toHaveAccessibleName(name!);
    }
  });

  it("keeps explicit list semantics on each row", () => {
    renderPlayer();
    for (const ol of screen.getAllByRole("list")) expect(ol).toHaveAttribute("role", "list");
  });

  it("does not fade text on skipped nodes (contrast)", () => {
    renderPlayer();
    const li = node("extra");
    expect(li.className).not.toMatch(/opacity-/);
    for (const el of li.querySelectorAll("*")) {
      if (el.closest("svg") || el.getAttribute("aria-hidden") === "true") continue;
      expect(el.getAttribute("class") ?? "").not.toMatch(/(^|\s)opacity-/);
    }
  });

  it("does not render an empty detail box for nodes without detail", () => {
    renderPlayer();
    expect(node("answer").querySelector("pre")).toBeNull();
    expect(node("extra").querySelector("pre")).toBeNull();
    expect(node("tool2").querySelector("pre")).toBeNull();
  });

  it("does not render a detail box for an empty-string detail", () => {
    renderPlayer({ rows: [{ id: "r", nodes: [{ id: "n", label: "N", status: "idle", detail: "" }] }] });
    expect(node("n").querySelector("pre")).toBeNull();
  });

  it("shows a row title when present and not when absent", () => {
    renderPlayer();
    expect(screen.getByText("Lần gọi tool thứ 2")).toBeInTheDocument();
    const titled = screen.getAllByRole("list")[1];
    expect(titled).toHaveAccessibleName("Lần gọi tool thứ 2");
  });

  it("uses one grid column per node", () => {
    renderPlayer();
    const lists = screen.getAllByRole("list");
    expect(lists[0].style.getPropertyValue("--flow-cols")).toBe("6");
    expect(lists[1].style.getPropertyValue("--flow-cols")).toBe("1");
  });

  it("turns off every animation and transition for reduced motion", () => {
    const { container } = renderPlayer();
    const animated = container.querySelectorAll("[class*='animate-'], [class*='transition']");
    expect(animated.length).toBeGreaterThan(0);
    for (const el of animated) {
      const classes = el.className.toString().split(/\s+/);
      if (classes.some((c) => /(^|:)animate-/.test(c) && !c.startsWith("motion-reduce:"))) {
        expect(classes).toContain("motion-reduce:animate-none");
      }
      if (classes.some((c) => /(^|:)transition/.test(c))) {
        expect(classes).toContain("motion-reduce:transition-none");
      }
    }
  });

  it("contains no emoji", () => {
    const { container } = renderPlayer();
    expect(container.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
