import { render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InviteSessionProvider } from "@/lib/invite/use-invite-session";
import viMessages from "../../../messages/vi.json";
import { LiveAwareBadge } from "./LiveAwareBadge";

const features = (over: Partial<Record<"chat" | "twistfit" | "gia_pha", boolean>>) => ({
  chat: false,
  twistfit: false,
  gia_pha: false,
  ...over,
});

function renderBadge(feature: "chat" | "twistfit" | undefined, session: { invited: boolean; features: object }) {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json(session)));
  return render(
    <NextIntlClientProvider locale="vi" messages={viMessages}>
      <InviteSessionProvider>
        <LiveAwareBadge locale="vi" feature={feature} />
      </InviteSessionProvider>
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LiveAwareBadge feature", () => {
  it('feature="twistfit" is live only when features.twistfit is on', async () => {
    const { container } = renderBadge("twistfit", { invited: true, features: features({ twistfit: true }) });
    await waitFor(() => expect(container.querySelector("[data-demo-kind]")).toHaveAttribute("data-demo-kind", "live"));
  });

  it('feature="twistfit" is a replay badge for an invite with chat only', async () => {
    const { container } = renderBadge("twistfit", { invited: true, features: features({ chat: true }) });
    await waitFor(() => expect(container.querySelector("[data-demo-kind]")).not.toBeNull());
    expect(container.querySelector("[data-demo-kind]")).toHaveAttribute("data-demo-kind", "replay");
  });

  it("defaults to chat: twistfit alone does not make it live", async () => {
    const { container } = renderBadge(undefined, { invited: true, features: features({ twistfit: true }) });
    await waitFor(() => expect(container.querySelector("[data-demo-kind]")).not.toBeNull());
    expect(container.querySelector("[data-demo-kind]")).toHaveAttribute("data-demo-kind", "replay");
  });

  it("chat feature is live with chat on", async () => {
    const { container } = renderBadge(undefined, { invited: true, features: features({ chat: true }) });
    await waitFor(() => expect(container.querySelector("[data-demo-kind]")).toHaveAttribute("data-demo-kind", "live"));
  });

  it("renders nothing until the session is known", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    const { container } = render(
      <NextIntlClientProvider locale="vi" messages={viMessages}>
        <InviteSessionProvider>
          <LiveAwareBadge locale="vi" feature="twistfit" />
        </InviteSessionProvider>
      </NextIntlClientProvider>,
    );
    expect(container.querySelector("[data-demo-kind]")).toBeNull();
    expect(screen.queryByText(viMessages.demo.badge.replay.label)).toBeNull();
  });
});
