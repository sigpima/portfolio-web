import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const cookieValue = vi.hoisted(() => ({ current: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "pf_admin" && cookieValue.current ? { name, value: cookieValue.current } : undefined,
  }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
// The real layout pulls next/font, which only works inside Next's compiler.
vi.mock("../fonts", () => ({ fontVariables: "" }));

import AdminPage from "./page";
import { metadata } from "./layout";

afterEach(() => {
  cookieValue.current = undefined;
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("/admin", () => {
  it("is never indexed", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("shows the login form without the admin cookie", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(await AdminPage());
    expect(screen.getByLabelText("Mật khẩu")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the dashboard with the admin cookie and passes SITE_URL", async () => {
    cookieValue.current = "adm_x";
    vi.stubEnv("SITE_URL", "");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json([])));
    render(await AdminPage());
    expect(await screen.findByRole("heading", { name: "Tạo link mới" })).toBeInTheDocument();
    expect(screen.getByText(/SITE_URL chưa được đặt/)).toBeInTheDocument();
  });

  it("treats an unusable SITE_URL (CHANGE_ME) as unset", async () => {
    cookieValue.current = "adm_x";
    vi.stubEnv("SITE_URL", "CHANGE_ME");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json([])));
    render(await AdminPage());
    expect(await screen.findByText(/SITE_URL chưa được đặt/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("CHANGE_ME");
  });

  it("passes a valid SITE_URL as its origin", async () => {
    cookieValue.current = "adm_x";
    vi.stubEnv("SITE_URL", "https://example.com/");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json([])));
    render(await AdminPage());
    expect(await screen.findByRole("heading", { name: "Tạo link mới" })).toBeInTheDocument();
    expect(screen.queryByText(/SITE_URL chưa được đặt/)).not.toBeInTheDocument();
  });
});
