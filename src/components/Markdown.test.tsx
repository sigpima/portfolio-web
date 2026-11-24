import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Markdown } from "./Markdown";

const ANSWER = "Bảo hành 24 tháng [chinh-sach-bao-hanh › Thời hạn tiêu chuẩn].";

describe("Markdown citations", () => {
  it("shows a citation as a chip, not as a link, and not clickable without onCite", () => {
    const { container } = render(<Markdown>{ANSWER}</Markdown>);
    const chip = container.querySelector('[data-role="citation"]')!;
    expect(chip.tagName).toBe("SPAN");
    expect(chip).toHaveTextContent("chinh-sach-bao-hanh › Thời hạn tiêu chuẩn");
    expect(container.querySelector("a")).toBeNull();
  });

  it("makes the chip a button that reports the citation once when clicked", async () => {
    const onCite = vi.fn();
    render(<Markdown onCite={onCite}>{ANSWER}</Markdown>);
    await userEvent.click(screen.getByRole("button", { name: "chinh-sach-bao-hanh › Thời hạn tiêu chuẩn" }));
    expect(onCite).toHaveBeenCalledTimes(1);
    expect(onCite).toHaveBeenCalledWith({ slug: "chinh-sach-bao-hanh", section: "Thời hạn tiêu chuẩn" });
  });

  it("keeps the chip plain when isCiteable says the document is unknown", () => {
    const { container } = render(
      <Markdown onCite={vi.fn()} isCiteable={() => false}>
        {ANSWER}
      </Markdown>,
    );
    expect(container.querySelector("button")).toBeNull();
    expect(container.querySelector('[data-role="citation"]')?.tagName).toBe("SPAN");
  });

  it("still opens ordinary links in a new tab and leaves code alone", () => {
    const { container } = render(<Markdown>{"[site](https://example.com) và `[a-b › c]`"}</Markdown>);
    const link = container.querySelector("a")!;
    expect(link).toHaveAttribute("target", "_blank");
    expect(container.querySelector('[data-role="citation"]')).toBeNull();
    expect(container.querySelector("code")).toHaveTextContent("[a-b › c]");
  });
});
