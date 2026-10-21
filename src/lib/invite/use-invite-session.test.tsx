import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InviteSessionProvider, useInviteSession, useInviteSessionActions } from "./use-invite-session";

function Probe({ id }: { id: string }) {
  const s = useInviteSession();
  return (
    <span data-testid={id}>
      {JSON.stringify({ ready: s.ready, invited: s.invited, features: s.features })}
    </span>
  );
}

function Actions() {
  const { invalidate } = useInviteSessionActions();
  return (
    <button type="button" onClick={invalidate}>
      invalidate
    </button>
  );
}

function state(id = "a") {
  return JSON.parse(screen.getByTestId(id).textContent ?? "{}");
}

const OFF = { chat: false, twistfit: false, gia_pha: false };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useInviteSession", () => {
  it("starts not ready, then reports the session from /api/session", async () => {
    let resolve!: (r: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((r) => (resolve = r)));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <InviteSessionProvider>
        <Probe id="a" />
      </InviteSessionProvider>,
    );
    expect(state()).toEqual({ ready: false, invited: false, features: OFF });
    await act(async () => {
      resolve(Response.json({ invited: true, features: { chat: true, twistfit: false, gia_pha: false } }));
    });
    await waitFor(() =>
      expect(state()).toEqual({
        ready: true,
        invited: true,
        features: { chat: true, twistfit: false, gia_pha: false },
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/session",
      expect.objectContaining({ cache: "no-store", signal: expect.any(AbortSignal) }),
    );
  });

  it("fetches only once for many consumers", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ invited: true, features: { chat: true, twistfit: false, gia_pha: false } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <InviteSessionProvider>
        <Probe id="a" />
        <Probe id="b" />
        <Probe id="c" />
      </InviteSessionProvider>,
    );
    await waitFor(() => expect(state("c").ready).toBe(true));
    expect(state("a").invited).toBe(true);
    expect(state("b").invited).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["network error", async () => Promise.reject(new TypeError("fetch failed"))],
    ["non-2xx", async () => Response.json({}, { status: 500 })],
    ["bad shape", async () => Response.json({ invited: "yes" })],
  ])("is ready but not invited on %s", async (_name, impl) => {
    vi.stubGlobal("fetch", vi.fn(impl));
    render(
      <InviteSessionProvider>
        <Probe id="a" />
      </InviteSessionProvider>,
    );
    await waitFor(() => expect(state()).toEqual({ ready: true, invited: false, features: OFF }));
  });

  it("aborts the request on unmount", () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        signal = init?.signal ?? undefined;
        return new Promise<Response>(() => {});
      }),
    );
    const { unmount } = render(
      <InviteSessionProvider>
        <Probe id="a" />
      </InviteSessionProvider>,
    );
    expect(signal?.aborted).toBe(false);
    unmount();
    expect(signal?.aborted).toBe(true);
  });

  it("does not touch web storage", async () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ invited: false, features: OFF })));
    render(
      <InviteSessionProvider>
        <Probe id="a" />
      </InviteSessionProvider>,
    );
    await waitFor(() => expect(state().ready).toBe(true));
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });

  it("invalidate() drops the session for every consumer without refetching", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ invited: true, features: { chat: true, twistfit: false, gia_pha: false } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <InviteSessionProvider>
        <Actions />
        <Probe id="a" />
        <Probe id="b" />
      </InviteSessionProvider>,
    );
    await waitFor(() => expect(state("a").invited).toBe(true));
    act(() => screen.getByRole("button", { name: "invalidate" }).click());
    expect(state("a")).toEqual({ ready: true, invited: false, features: OFF });
    expect(state("b")).toEqual({ ready: true, invited: false, features: OFF });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("invalidate() before /api/session answers wins over the late answer", async () => {
    let resolve!: (r: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((r) => (resolve = r))));
    render(
      <InviteSessionProvider>
        <Actions />
        <Probe id="a" />
      </InviteSessionProvider>,
    );
    act(() => screen.getByRole("button", { name: "invalidate" }).click());
    await act(async () => {
      resolve(Response.json({ invited: true, features: { chat: true, twistfit: false, gia_pha: false } }));
    });
    expect(state("a")).toEqual({ ready: true, invited: false, features: OFF });
  });
});
