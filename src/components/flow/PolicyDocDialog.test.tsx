import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import type { Locale } from "@/content/types";
import viMessages from "../../../messages/vi.json";
import enMessages from "../../../messages/en.json";
import { PolicyDocDialog } from "./PolicyDocDialog";

function renderDialog(citation: { slug: string; section: string }, locale: Locale = "vi", onClose = vi.fn()) {
  const messages = locale === "vi" ? viMessages : enMessages;
  render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <PolicyDocDialog citation={citation} closeLabel={messages.kb.policy.close} onClose={onClose} />
    </NextIntlClientProvider>,
  );
  return onClose;
}

const WARRANTY = { slug: "chinh-sach-bao-hanh", section: "Giữ lại bảo hành" };
/** The document has loaded once its synthetic notice is on screen (the dialog itself opens at once). */
const loaded = (locale: Locale = "vi") =>
  screen.findByText((locale === "vi" ? viMessages : enMessages).kb.policy.synthetic);

describe("PolicyDocDialog", () => {
  it("shows a loading text first, then the whole document", async () => {
    renderDialog(WARRANTY);
    expect(screen.getByText(viMessages.kb.policy.loading)).toBeInTheDocument();
    const dialog = await screen.findByRole("dialog", { name: "Chính sách bảo hành công trình sơn" });
    expect(within(dialog).getByText(viMessages.kb.policy.synthetic)).toBeInTheDocument();
    expect(within(dialog).getByText(`${viMessages.kb.policy.docType.warranty} · chinh-sach-bao-hanh`)).toBeInTheDocument();
    // Several sections of the same document are there, not only the cited one.
    expect(within(dialog).getByRole("heading", { name: "Gia hạn bảo hành" })).toBeInTheDocument();
  });

  it("highlights exactly the cited section", async () => {
    renderDialog(WARRANTY);
    await loaded();
    const cited = document.querySelectorAll('[data-role="cited-section"]');
    expect(cited).toHaveLength(1);
    expect(within(cited[0] as HTMLElement).getByRole("heading")).toHaveTextContent("Giữ lại bảo hành");
  });

  it("finds the section from the full path the policy search reports", async () => {
    renderDialog({ slug: "chinh-sach-bao-hanh", section: "Chính sách bảo hành công trình sơn › Giữ lại bảo hành" });
    await loaded();
    expect(document.querySelectorAll('[data-role="cited-section"]')).toHaveLength(1);
  });

  it("opens the document with nothing highlighted when the section matches no heading", async () => {
    renderDialog({ slug: "chinh-sach-bao-hanh", section: "Một mục không có" });
    await loaded();
    expect(screen.getByRole("dialog", { name: "Chính sách bảo hành công trình sơn" })).toBeInTheDocument();
    expect(document.querySelectorAll('[data-role="cited-section"]')).toHaveLength(0);
  });

  it("says the document cannot be found for an unknown slug", async () => {
    renderDialog({ slug: "khong-co-tai-lieu", section: "X" });
    expect(await screen.findByText(viMessages.kb.policy.notFound)).toBeInTheDocument();
    expect(document.querySelectorAll('[data-role="cited-section"]')).toHaveLength(0);
  });

  it("closes on Escape and with the close button", async () => {
    const onClose = renderDialog(WARRANTY);
    const dialog = screen.getByRole("dialog");
    await loaded();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    await userEvent.click(within(dialog).getByRole("button", { name: viMessages.kb.policy.close }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("keeps the document in Vietnamese and the surrounding text in English on the English site", async () => {
    renderDialog(WARRANTY, "en");
    const dialog = screen.getByRole("dialog");
    await loaded("en");
    expect(within(dialog).getByRole("button", { name: "Close" })).toBeInTheDocument();
    expect(within(dialog).getByText(enMessages.kb.policy.synthetic)).toBeInTheDocument();
    const body = within(dialog).getByRole("heading", { name: "Giữ lại bảo hành" }).closest("[lang]");
    expect(body).toHaveAttribute("lang", "vi");
    expect(within(dialog).getByText(enMessages.kb.policy.synthetic).closest("[lang='vi']")).toBeNull();
  });
});
