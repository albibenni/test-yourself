/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/unbound-method, @typescript-eslint/require-await */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTodoist } from "./useTodoist";
import { load } from "@tauri-apps/plugin-store";
import { getSecureToken } from "../utils/secureStore";
import { TodoistProvider } from "../providers/TodoistProvider";

vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn(),
}));

vi.mock("../utils/secureStore", () => ({
  getSecureToken: vi.fn(),
}));

vi.mock("../providers/TodoistProvider", () => {
  return {
    TodoistProvider: vi.fn().mockImplementation(function () {
      return {
        getProjects: vi.fn().mockResolvedValue([{ id: "1", name: "Inbox" }]),
        getTasks: vi.fn().mockResolvedValue([]),
        addTask: vi.fn().mockResolvedValue({ id: "2", content: "New task" }),
      };
    }),
  };
});

describe("useTodoist hook", () => {
  let mockStoreGet: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreGet = vi.fn().mockResolvedValue(null);
    vi.mocked(load).mockResolvedValue({
      get: mockStoreGet,
    } as unknown as Awaited<ReturnType<typeof load>>);

    vi.mocked(window.localStorage.getItem).mockReturnValue(null);
  });

  it("prioritizes secureStore token over fallback store or localStorage", async () => {
    vi.mocked(getSecureToken).mockResolvedValue("secure-token-123");
    mockStoreGet.mockImplementation(async (key: string) => {
      if (key === "todoist_token") return "store-token-456";
      return null;
    });
    vi.mocked(window.localStorage.getItem).mockImplementation((k) =>
      k === "todoist_token" ? "local-token-789" : null,
    );

    const { result } = renderHook(() => useTodoist());

    await act(async () => {
      const projects = await result.current.getProjects();
      expect(projects).toEqual([{ id: "1", name: "Inbox" }]);
    });

    expect(getSecureToken).toHaveBeenCalledWith("todoist_token");
    expect(TodoistProvider).toHaveBeenCalledWith("secure-token-123");
  });

  it("falls back to plugin-store token if secure token is missing", async () => {
    vi.mocked(getSecureToken).mockResolvedValue(null);
    mockStoreGet.mockImplementation(async (key: string) => {
      if (key === "todoist_token") return "store-token-456";
      return null;
    });
    vi.mocked(window.localStorage.getItem).mockImplementation((k) =>
      k === "todoist_token" ? "local-token-789" : null,
    );

    const { result } = renderHook(() => useTodoist());

    await act(async () => {
      await result.current.getProjects();
    });

    expect(TodoistProvider).toHaveBeenCalledWith("store-token-456");
  });

  it("falls back to window.localStorage if store token is also missing", async () => {
    vi.mocked(getSecureToken).mockResolvedValue(null);
    mockStoreGet.mockResolvedValue(null);
    vi.mocked(window.localStorage.getItem).mockImplementation((k) =>
      k === "todoist_token" ? "local-token-789" : null,
    );

    const { result } = renderHook(() => useTodoist());

    await act(async () => {
      await result.current.getProjects();
    });

    expect(TodoistProvider).toHaveBeenCalledWith("local-token-789");
  });

  it("throws an error and sets error state if no token is found", async () => {
    vi.mocked(getSecureToken).mockResolvedValue(null);
    mockStoreGet.mockResolvedValue(null);

    const { result } = renderHook(() => useTodoist());

    await act(async () => {
      await expect(result.current.getProjects()).rejects.toThrow(
        "Missing API token",
      );
    });

    expect(result.current.error).toBe(
      "Failed to fetch projects. Check your token.",
    );
    expect(result.current.loading).toBe(false);
  });

  it("fetches tasks successfully using the provider", async () => {
    vi.mocked(getSecureToken).mockResolvedValue("secure-token-123");

    const { result } = renderHook(() => useTodoist());

    let tasks;
    await act(async () => {
      tasks = await result.current.getTasks();
    });

    expect(tasks).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe("");
  });

  it("adds a task successfully using the provider", async () => {
    vi.mocked(getSecureToken).mockResolvedValue("secure-token-123");

    const { result } = renderHook(() => useTodoist());

    let newTask;
    await act(async () => {
      newTask = await result.current.addTask({
        title: "New task",
        date: "today",
      });
    });

    expect(newTask).toEqual({ id: "2", content: "New task" });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe("");
  });

  it("gets the vault name correctly from store, then local storage, then fallback", async () => {
    // 1. From store
    mockStoreGet.mockImplementation(async (key: string) => {
      if (key === "obsidian_vault") return "StoreVault";
      return null;
    });

    const { result } = renderHook(() => useTodoist());

    let vaultName;
    await act(async () => {
      vaultName = await result.current.getVaultName();
    });
    expect(vaultName).toBe("StoreVault");

    // 2. From localStorage
    mockStoreGet.mockResolvedValue(null);
    vi.mocked(window.localStorage.getItem).mockImplementation((k) =>
      k === "obsidian_vault" ? "LocalVault" : null,
    );

    await act(async () => {
      vaultName = await result.current.getVaultName();
    });
    expect(vaultName).toBe("LocalVault");

    // 3. Fallback
    vi.mocked(window.localStorage.getItem).mockReturnValue(null);
    await act(async () => {
      vaultName = await result.current.getVaultName();
    });
    expect(vaultName).toBe("Vault");
  });

  it("gets default settings correctly from the store", async () => {
    mockStoreGet.mockImplementation(async (key: string) => {
      if (key === "default_todoist_date") return "today";
      if (key === "default_todoist_priority") return 2;
      if (key === "default_todoist_project") return "proj_123";
      return null;
    });

    const { result } = renderHook(() => useTodoist());

    let settings;
    await act(async () => {
      settings = await result.current.getDefaultSettings();
    });

    expect(settings).toEqual({
      defaultDate: "today",
      defaultPriority: 2,
      defaultProject: "proj_123",
    });
  });
});
