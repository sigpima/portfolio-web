import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { FlowState, NodeStatus } from "@/lib/flow/model";
import { FlowPlayer, type FlowDataLabels } from "./FlowPlayer";

const statusLabels: Record<NodeStatus, string> = {
  idle: "Chờ",
  active: "Đang chạy",
  done: "Xong",
  error: "Lỗi",
  skipped: "Bỏ qua",
};
const dataLabels: FlowDataLabels = { open: "Xem chi tiết (JSON)", close: "Đóng" };

const state: FlowState = {
  rows: [
    { id: "start", nodes: [{ id: "question", label: "Câu hỏi", status: "done" }] },
    {
      id: "call-1",
      nodes: [
        {
          id: "model-1",
          label: "Gemini chọn tool",
          status: "done",
          data: { title: "Tool và tham số", hint: "Tham số", value: { tool: "find_quotations", args: { limit: 1, vip: true, note: null } } },
        },
        { id: "tool-1", label: "MCP tool", status: "done", meta: "42 ms" },
        {
          id: "db-1",
          label: "Postgres",
          status: "done",
          data: { title: "Kết quả Postgres", hint: "Kết quả", value: { ok: true, row_count: 1, sql: "SELECT 1" } },
        },
      ],
    },
    { id: "end", nodes: [{ id: "answer", label: "Trả lời", status: "active" }] },
  ],
};

function renderPlayer(withLabels = true) {
  return render(
    <FlowPlayer
      state={state}
      label="Luồng"
      statusLabels={statusLabels}
      dataLabels={withLabels ? dataLabels : undefined}
    />,
  );
}

describe("FlowPlayer rows", () => {
  it("renders one list per row, in order, with a link between rows and none after the last", () => {
    renderPlayer();
    const rows = Array.from(document.querySelectorAll("[data-row-id]")).map((el) => el.getAttribute("data-row-id"));
    expect(rows).toEqual(["start", "call-1", "end"]);
    const links = Array.from(document.querySelectorAll('[data-role="row-link"]'));
    expect(links).toHaveLength(2);
    // The link takes the status of the last node of the row above it.
    expect(links.map((l) => l.getAttribute("data-status"))).toEqual(["done", "done"]);
    expect(links.every((l) => l.getAttribute("aria-hidden") === "true")).toBe(true);
  });

  it("shows a row title only when the row has one", () => {
    render(
      <FlowPlayer
        state={{ rows: [{ id: "a", nodes: [{ id: "n", label: "N", status: "idle" }] }, { id: "b", title: "Lần gọi tool 2", nodes: [{ id: "m", label: "M", status: "idle" }] }] }}
        label="L"
        statusLabels={statusLabels}
      />,
    );
    expect(screen.getByText("Lần gọi tool 2")).toBeInTheDocument();
    expect(screen.getAllByRole("list")).toHaveLength(2);
  });
});

describe("FlowPlayer equal-height rows", () => {
  it("stretches the boxes of a row that carries chips, and leaves other rows alone", () => {
    renderPlayer();
    const call = document.querySelector('[data-row-id="call-1"] ol') as HTMLElement;
    expect(call.className).toContain("items-stretch");
    for (const li of Array.from(call.querySelectorAll("li"))) {
      expect(li.className).toContain("flex-col");
      const box = li.querySelector("button, div > div") as HTMLElement;
      expect(box.className).toContain("h-full");
    }
    expect(document.querySelector('[data-row-id="start"] ol')?.className).not.toContain("items-stretch");
  });
});

describe("FlowPlayer node data", () => {
  it("makes only the nodes that carry data clickable, with a named `{ }` chip and no JSON in view", () => {
    renderPlayer();
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toHaveAttribute("aria-haspopup", "dialog");
    expect(buttons[0].querySelector('[data-role="node-data-chip"]')).toHaveTextContent("{ } Tham số");
    expect(buttons[1].querySelector('[data-role="node-data-chip"]')).toHaveTextContent("{ } Kết quả");
    expect(buttons[0]).toHaveTextContent("Xem chi tiết (JSON)");
    // No summary line, no old "click to view" wording.
    expect(document.body).not.toHaveTextContent(/find_quotations\(|Bấm để xem/);
    // The plain node has no button; its duration is a chip inside the box, next to the others' data chips.
    const tool = document.querySelector('li[data-node-id="tool-1"]') as HTMLElement;
    expect(within(tool).queryByRole("button")).toBeNull();
    expect(tool.querySelector('[data-role="node-meta"]')).toHaveTextContent("42 ms");
    expect(tool.querySelector("pre")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body).not.toHaveTextContent('"tool"');
  });

  it("without dataLabels nothing is clickable", () => {
    renderPlayer(false);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("opens a modal with highlighted JSON on click, and closes it with the button", async () => {
    const user = userEvent.setup();
    renderPlayer();
    const opener = screen.getAllByRole("button")[0];
    await user.click(opener);

    const dialog = screen.getByRole("dialog", { name: "Tool và tham số" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const json = within(dialog).getByText((_, el) => el?.getAttribute("data-role") === "json");
    expect(json.textContent).toBe('{\n  "tool": "find_quotations",\n  "args": {\n    "limit": 1,\n    "vip": true,\n    "note": null\n  }\n}');
    // Colour classes distinguish keys, strings, numbers, booleans and null.
    expect(json.querySelector(".text-secondary")?.textContent).toBe('"tool"');
    expect(json.querySelector(".text-syntax-string")?.textContent).toBe('"find_quotations"');
    expect(json.querySelector(".text-syntax-number")?.textContent).toBe("1");
    expect(json.querySelector(".text-syntax-boolean")?.textContent).toBe("true");
    expect(within(dialog).getByRole("button", { name: "Đóng" })).toHaveFocus();

    await user.click(within(dialog).getByRole("button", { name: "Đóng" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
  });

  it("closes on Escape and on a click on the backdrop, but not on a click inside the panel", async () => {
    const user = userEvent.setup();
    renderPlayer();
    await user.click(screen.getAllByRole("button")[1]);
    expect(screen.getByRole("dialog", { name: "Kết quả Postgres" })).toBeInTheDocument();

    await user.click(screen.getByRole("dialog"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(screen.getAllByRole("button")[1]);
    await user.click(document.querySelector('[data-role="flow-dialog-backdrop"]') as HTMLElement);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps Tab inside the open dialog and restores page scrolling when it closes", async () => {
    const user = userEvent.setup();
    renderPlayer();
    await user.click(screen.getAllByRole("button")[0]);
    expect(document.body.style.overflow).toBe("hidden");
    const close = screen.getByRole("button", { name: "Đóng" });
    expect(close).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("dialog")).toContainElement(document.activeElement as HTMLElement);
    await user.keyboard("{Escape}");
    expect(document.body.style.overflow).toBe("");
  });

  it("closes by itself when the node loses its data (a new question resets the diagram)", async () => {
    const user = userEvent.setup();
    const { rerender } = renderPlayer();
    await user.click(screen.getAllByRole("button")[0]);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const reset: FlowState = {
      rows: state.rows.map((row) => ({
        ...row,
        nodes: row.nodes.map((n) => ({ ...n, data: undefined, meta: undefined, status: "idle" as const })),
      })),
    };
    rerender(<FlowPlayer state={reset} label="Luồng" statusLabels={statusLabels} dataLabels={dataLabels} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("FlowPlayer policy sources", () => {
  const SOURCES = [
    { slug: "chinh-sach-bao-hanh", section: "Chính sách bảo hành công trình sơn › Giữ lại bảo hành", score: 0.78 },
    { slug: "xu-ly-be-mat", section: "Xử lý bề mặt › Chà nhám", score: 0.7 },
  ];
  const withSources: FlowState = {
    rows: [
      {
        id: "call-1",
        nodes: [
          {
            id: "db-1",
            label: "Milvus",
            status: "done",
            data: {
              title: "Các đoạn chính sách tìm được",
              hint: "Nguồn",
              sources: SOURCES,
              value: { ok: true, row_count: 2, passages: SOURCES },
            },
          },
        ],
      },
    ],
  };
  const player = (onOpenSource?: (s: (typeof SOURCES)[number]) => void) =>
    render(
      <FlowPlayer
        state={withSources}
        label="Luồng"
        statusLabels={statusLabels}
        dataLabels={dataLabels}
        onOpenSource={onOpenSource}
      />,
    );

  it("lists each source as a button in the popup, with its score, when a handler is given", async () => {
    const user = userEvent.setup();
    player(vi.fn());
    await user.click(screen.getByRole("button", { name: /Nguồn/ }));
    const dialog = screen.getByRole("dialog");
    const buttons = within(dialog).getAllByRole("button", { name: /›/ });
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toHaveTextContent("chinh-sach-bao-hanh › Chính sách bảo hành công trình sơn › Giữ lại bảo hành · 0.78");
    expect(buttons[1]).toHaveTextContent("xu-ly-be-mat › Xử lý bề mặt › Chà nhám · 0.70");
  });

  it("closes the popup and reports the source that was clicked", async () => {
    const user = userEvent.setup();
    const onOpenSource = vi.fn();
    player(onOpenSource);
    await user.click(screen.getByRole("button", { name: /Nguồn/ }));
    await user.click(within(screen.getByRole("dialog")).getAllByRole("button", { name: /›/ })[1]);
    expect(onOpenSource).toHaveBeenCalledTimes(1);
    expect(onOpenSource).toHaveBeenCalledWith(SOURCES[1]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows no source buttons without a handler, only the JSON", async () => {
    const user = userEvent.setup();
    player();
    await user.click(screen.getByRole("button", { name: /Nguồn/ }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getAllByRole("button")).toHaveLength(1); // the close button
    expect(dialog).toHaveTextContent('"passages"');
  });
});
