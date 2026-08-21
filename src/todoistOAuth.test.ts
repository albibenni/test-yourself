import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  completeTodoistAuthorization,
  getAuthorizedTodoistToken,
  refreshTodoistAccessToken,
} from "./todoistOAuth";
import { getSecureToken, setSecureToken } from "./utils/secureStore";

vi.mock("./utils/secureStore", () => ({
  getSecureToken: vi.fn(),
  setSecureToken: vi.fn(),
}));

describe("Todoist OAuth", () => {
  const expiredSession = JSON.stringify({
    access_token: "expired-access-token",
    refresh_token: "refresh-token",
    expires_in: 3600,
    expires_at: Date.now() - 1,
    token_type: "Bearer",
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSecureToken).mockResolvedValue(expiredSession);
  });

  it("shares one refresh request between concurrent token consumers", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        expires_in: 3600,
        token_type: "Bearer",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      Promise.all([getAuthorizedTodoistToken(), getAuthorizedTodoistToken()]),
    ).resolves.toEqual(["new-access-token", "new-access-token"]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(setSecureToken).toHaveBeenCalledTimes(1);
  });

  it("can explicitly refresh a valid stored connection", async () => {
    vi.mocked(getSecureToken).mockResolvedValue(
      JSON.stringify({
        ...JSON.parse(expiredSession),
        expires_at: Date.now() + 3600_000,
      }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: "manually-refreshed-token",
          refresh_token: "new-refresh-token",
          expires_in: 3600,
          token_type: "Bearer",
        }),
      }),
    );

    await expect(refreshTodoistAccessToken()).resolves.toBe(
      "manually-refreshed-token",
    );
  });

  it("ignores non-OAuth deep links without attempting a token exchange", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      completeTodoistAuthorization("test-yourself://open?quiz=React.md"),
    ).resolves.toBe(false);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("exchanges a callback only once when it is delivered twice", async () => {
    window.sessionStorage.setItem("todoist_oauth_state", "expected-state");
    window.sessionStorage.setItem("todoist_oauth_verifier", "verifier");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        expires_in: 3600,
        token_type: "Bearer",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const callback =
      "test-yourself://todoist-auth?code=authorization-code&state=expected-state";

    await expect(
      Promise.all([
        completeTodoistAuthorization(callback),
        completeTodoistAuthorization(callback),
      ]),
    ).resolves.toEqual([true, true]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(setSecureToken).toHaveBeenCalledTimes(1);
  });
});
