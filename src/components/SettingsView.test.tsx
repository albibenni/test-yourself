/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call */

import { open } from "@tauri-apps/plugin-dialog";
import { load } from "@tauri-apps/plugin-store";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSecureToken, setSecureToken } from "../utils/secureStore";
import { SettingsView } from "./SettingsView";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(false),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => undefined),
}));

vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn(),
}));

import type { AccentColor, TextColor, ThemeType } from "../types";

vi.mock("../utils/secureStore", () => ({
  getSecureToken: vi.fn(),
  setSecureToken: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("@tauri-apps/api/app", () => ({
  getVersion: vi.fn().mockResolvedValue("1.0.0"),
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: vi.fn().mockResolvedValue(null),
}));

describe("SettingsView", () => {
  let mockStore: {
    get: import("vitest").Mock;
    set: import("vitest").Mock;
    save: import("vitest").Mock;
    delete: import("vitest").Mock;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(window.localStorage.getItem).mockReturnValue(null);
    mockStore = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(true),
      save: vi.fn().mockResolvedValue(true),
      delete: vi.fn().mockResolvedValue(true),
    };
    vi.mocked(load).mockResolvedValue(
      mockStore as unknown as Awaited<ReturnType<typeof load>>,
    );
    vi.mocked(getSecureToken).mockResolvedValue(null);
  });

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    theme: "system" as ThemeType,
    accent: "blue" as AccentColor,
    textColor: "slate" as TextColor,
    textScale: "default" as const,
    contrast: "system" as const,
    reducedMotion: "system" as const,
    onThemeChange: vi.fn(),
    onAccentChange: vi.fn(),
    onTextColorChange: vi.fn(),
    onTextScaleChange: vi.fn(),
    onContrastChange: vi.fn(),
    onReducedMotionChange: vi.fn(),
  };

  it("renders tabs and switches between them", async () => {
    render(<SettingsView {...defaultProps} />);

    // Wait for initial load to avoid act warnings
    await waitFor(() => {
      expect(mockStore.get).toHaveBeenCalled();
    });

    // Default tab is General
    expect(
      screen.getByRole("heading", { name: "General", level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Quiz Directory")).toBeInTheDocument();

    // Switch to Appearance
    fireEvent.click(screen.getAllByText("Appearance")[0]);
    expect(
      screen.getByRole("heading", { name: "Appearance", level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Theme")).toBeInTheDocument();

    // Switch to About
    fireEvent.click(screen.getAllByText("About")[0]);
    expect(
      screen.getByRole("heading", { name: "About", level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByText("App Version")).toBeInTheDocument();
  });

  it("calls onChange handlers when using segmented controls", async () => {
    render(<SettingsView {...defaultProps} />);

    // Wait for initial load to avoid act warnings
    await waitFor(() => {
      expect(mockStore.get).toHaveBeenCalled();
    });

    // Switch to Appearance tab
    fireEvent.click(screen.getAllByText("Appearance")[0]);

    // Click Light theme
    fireEvent.click(screen.getByRole("button", { name: "Light" }));
    expect(defaultProps.onThemeChange).toHaveBeenCalledWith("light");

    // Click Stone text tone
    fireEvent.click(screen.getByRole("button", { name: "Stone" }));
    expect(defaultProps.onTextColorChange).toHaveBeenCalledWith("stone");

    fireEvent.click(screen.getByRole("button", { name: "Large" }));
    expect(defaultProps.onTextScaleChange).toHaveBeenCalledWith("large");

    fireEvent.click(screen.getByRole("button", { name: "Small" }));
    expect(defaultProps.onTextScaleChange).toHaveBeenCalledWith("small");

    fireEvent.click(screen.getByRole("button", { name: "High" }));
    expect(defaultProps.onContrastChange).toHaveBeenCalledWith("more");

    fireEvent.click(screen.getByRole("button", { name: "Reduce" }));
    expect(defaultProps.onReducedMotionChange).toHaveBeenCalledWith("reduce");

    // Click purple accent
    fireEvent.click(screen.getByRole("button", { name: "purple" }));
    expect(defaultProps.onAccentChange).toHaveBeenCalledWith("purple");
  });

  it("preserves an OAuth session when saving other settings", async () => {
    vi.mocked(getSecureToken).mockResolvedValue(
      JSON.stringify({
        access_token: "oauth-access-token",
        refresh_token: "oauth-refresh-token",
        expires_in: 3600,
        expires_at: Date.now() + 3600_000,
        token_type: "Bearer",
      }),
    );

    render(<SettingsView {...defaultProps} />);
    fireEvent.click(screen.getAllByText("Integrations")[0]);

    await waitFor(() => {
      expect(
        screen.getByText("Connected securely with Todoist."),
      ).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText("e.g. MyVault"), {
      target: { value: "UpdatedVault" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(mockStore.save).toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
    expect(setSecureToken).not.toHaveBeenCalled();
  });

  it("keeps the default-project options open inside the scrollable settings content", async () => {
    render(<SettingsView {...defaultProps} />);
    fireEvent.click(screen.getAllByText("Integrations")[0]);

    await waitFor(() => {
      expect(mockStore.get).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Default project" }));

    expect(
      screen.getByRole("listbox", { name: "Default project options" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Inbox (Default)" }),
    ).toBeInTheDocument();
  });

  it("selects vault folder via dialog", async () => {
    vi.mocked(open).mockResolvedValue("/new/mock/MyVault");

    render(<SettingsView {...defaultProps} />);
    fireEvent.click(screen.getAllByText("Integrations")[0]);

    // Wait for initial load
    await waitFor(() => {
      expect(mockStore.get).toHaveBeenCalled();
    });

    const browseBtn = screen.getByRole("button", { name: "Browse..." });
    fireEvent.click(browseBtn);

    await waitFor(() => {
      expect(open).toHaveBeenCalledWith({
        directory: true,
        multiple: false,
        recursive: true,
        fileAccessMode: "scoped",
      });
      expect(screen.getByDisplayValue("MyVault")).toBeInTheDocument();
    });
  });

  it("prevents multiple concurrent saves while saving is in progress", async () => {
    // Make store.save take some time to simulate async delay
    let resolveSave: (value: unknown) => void;
    mockStore.save.mockReturnValue(
      new Promise((resolve) => {
        resolveSave = resolve;
      }),
    );

    render(<SettingsView {...defaultProps} />);

    await waitFor(() => {
      expect(mockStore.get).toHaveBeenCalled();
    });

    const saveButton = screen.getByRole("button", { name: "Save Changes" });

    // Click save 3 times rapidly
    fireEvent.click(saveButton);
    fireEvent.click(saveButton);
    fireEvent.click(saveButton);

    // The button should show "Saving..." and be disabled
    expect(saveButton).toHaveTextContent("Saving...");
    expect(saveButton).toBeDisabled();

    // Verify store.save was only called once
    await waitFor(() => {
      expect(mockStore.save).toHaveBeenCalledTimes(1);
    });

    // Resolve the save
    resolveSave!(true);

    await waitFor(() => {
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it("handles save failure gracefully and resets isSaving state", async () => {
    // Force the main store.save to reject
    mockStore.save.mockRejectedValue(new Error("Disk write error"));
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {
        /* intentionally empty */
      });

    render(<SettingsView {...defaultProps} />);

    await waitFor(() => {
      expect(mockStore.get).toHaveBeenCalled();
    });

    const saveButton = screen.getByRole("button", { name: "Save Changes" });
    fireEvent.click(saveButton);

    await waitFor(() => {
      // It should log the error
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to save settings",
        expect.any(Error),
      );
      // The modal should NOT close because it failed
      expect(defaultProps.onClose).not.toHaveBeenCalled();
      // The button should be re-enabled and text restored
      expect(saveButton).toHaveTextContent("Save Changes");
      expect(saveButton).not.toBeDisabled();
    });

    consoleErrorSpy.mockRestore();
  });
});
