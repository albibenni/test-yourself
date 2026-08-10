import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSecureToken, setSecureToken } from "./secureStore";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("secureStore", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads the Todoist token through the native credential command", async () => {
    vi.mocked(invoke).mockResolvedValue("keychain-token");

    await expect(getSecureToken("todoist_token")).resolves.toBe(
      "keychain-token",
    );
    expect(invoke).toHaveBeenCalledWith("get_secret");
  });

  it("writes and clears the Todoist token through the native credential command", async () => {
    await setSecureToken("todoist_token", "keychain-token");
    await setSecureToken("todoist_token", "");

    expect(invoke).toHaveBeenNthCalledWith(1, "set_secret", {
      secret: "keychain-token",
    });
    expect(invoke).toHaveBeenNthCalledWith(2, "set_secret", { secret: "" });
  });

  it("rejects unsupported keys instead of writing arbitrary secrets", async () => {
    await expect(setSecureToken("other", "value")).rejects.toThrow(
      "Unsupported secure-storage key",
    );
    await expect(getSecureToken("other")).resolves.toBeNull();
  });
});
