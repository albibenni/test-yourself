import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { loadMock } = vi.hoisted(() => ({ loadMock: vi.fn() }));

vi.mock("@tauri-apps/plugin-store", () => ({ load: loadMock }));

import { useTheme } from "./useTheme";

describe("useTheme text scale", () => {
  afterEach(() => {
    vi.clearAllMocks();
    document.documentElement.removeAttribute("data-text-scale");
    document.documentElement.removeAttribute("data-contrast");
    document.documentElement.removeAttribute("data-reduced-motion");
  });

  it("restores a saved text-size preference and applies it to the document", async () => {
    const store = {
      get: vi
        .fn()
        .mockImplementation((key: string) =>
          Promise.resolve(key === "app_text_scale" ? "small" : null),
        ),
      set: vi.fn(),
      save: vi.fn(),
    };
    loadMock.mockResolvedValue(store);

    const { result } = renderHook(() => useTheme());

    await waitFor(() => expect(result.current.textScale).toBe("small"));

    expect(document.documentElement).toHaveAttribute(
      "data-text-scale",
      "small",
    );
  });

  it("saves and applies a new text-size preference", async () => {
    const store = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
    };
    loadMock.mockResolvedValue(store);
    const { result } = renderHook(() => useTheme());

    await waitFor(() =>
      expect(store.get).toHaveBeenCalledWith("app_reduced_motion"),
    );
    await act(async () => {
      await result.current.saveTextScale("larger");
    });

    await waitFor(() => expect(result.current.textScale).toBe("larger"));
    expect(store.set).toHaveBeenCalledWith("app_text_scale", "larger");
    expect(store.save).toHaveBeenCalledOnce();
    expect(document.documentElement).toHaveAttribute(
      "data-text-scale",
      "larger",
    );
  });

  it("saves and applies contrast and reduced-motion preferences", async () => {
    const store = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
    };
    loadMock.mockResolvedValue(store);
    const { result } = renderHook(() => useTheme());

    await waitFor(() =>
      expect(store.get).toHaveBeenCalledWith("app_reduced_motion"),
    );
    await act(async () => {
      await result.current.saveContrast("more");
      await result.current.saveReducedMotion("reduce");
    });

    expect(document.documentElement).toHaveAttribute("data-contrast", "more");
    expect(document.documentElement).toHaveAttribute(
      "data-reduced-motion",
      "reduce",
    );
    expect(store.set).toHaveBeenCalledWith("app_contrast", "more");
    expect(store.set).toHaveBeenCalledWith("app_reduced_motion", "reduce");
  });
});
