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
    onThemeChange: vi.fn(),
    onAccentChange: vi.fn(),
    onTextColorChange: vi.fn(),
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

    // Click purple accent
    fireEvent.click(screen.getByRole("button", { name: "purple" }));
    expect(defaultProps.onAccentChange).toHaveBeenCalledWith("purple");
  });

  it("loads secure token if available", async () => {
    vi.mocked(getSecureToken).mockResolvedValue("secure-token-value");

    render(<SettingsView {...defaultProps} />);
    fireEvent.click(screen.getAllByText("Integrations")[0]);

    await waitFor(() => {
      expect(
        screen.getByDisplayValue("secure-token-value"),
      ).toBeInTheDocument();
    });
  });

  it("saves token via secureStore and cleans up localStorage", async () => {
    render(<SettingsView {...defaultProps} />);
    fireEvent.click(screen.getAllByText("Integrations")[0]);

    // Wait for initial load
    await waitFor(() => {
      expect(mockStore.get).toHaveBeenCalled();
    });

    // Enter a token
    const tokenInput = screen.getByPlaceholderText(
      "Enter your Todoist API token",
    );
    fireEvent.change(tokenInput, { target: { value: "new-token-123" } });

    // Save
    const saveButton = screen.getByRole("button", { name: "Save Changes" });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(setSecureToken).toHaveBeenCalledWith(
        "todoist_token",
        "new-token-123",
      );
      expect(mockStore.set).toHaveBeenCalledWith("todoist_token", ""); // Cleans up unencrypted
      expect(mockStore.save).toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
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
      expect(open).toHaveBeenCalledWith({ directory: true, multiple: false });
      expect(screen.getByDisplayValue("MyVault")).toBeInTheDocument();
    });
  });

  it("does not call setSecureToken if the token was already in secure store and hasn't changed", async () => {
    vi.mocked(getSecureToken).mockResolvedValue("existing-secure-token");

    render(<SettingsView {...defaultProps} />);
    fireEvent.click(screen.getAllByText("Integrations")[0]);

    await waitFor(() => {
      expect(
        screen.getByDisplayValue("existing-secure-token"),
      ).toBeInTheDocument();
    });

    // Change another setting (e.g., Vault Name)
    const vaultInput = screen.getByPlaceholderText("e.g. MyVault");
    fireEvent.change(vaultInput, { target: { value: "UpdatedVault" } });

    const saveButton = screen.getByRole("button", { name: "Save Changes" });
    fireEvent.click(saveButton);

    await waitFor(() => {
      // Vault name was saved
      expect(mockStore.set).toHaveBeenCalledWith(
        "obsidian_vault",
        "UpdatedVault",
      );
      // Ultimately, it matches the initial secure token, so skip encryption
      expect(setSecureToken).not.toHaveBeenCalled();
    });
  });

  it("does not call setSecureToken if the token is changed and then changed back to the original secureToken", async () => {
    vi.mocked(getSecureToken).mockResolvedValue("existing-secure-token");

    render(<SettingsView {...defaultProps} />);
    fireEvent.click(screen.getAllByText("Integrations")[0]);

    await waitFor(() => {
      expect(
        screen.getByDisplayValue("existing-secure-token"),
      ).toBeInTheDocument();
    });

    // Change token to something else
    const tokenInput = screen.getByPlaceholderText(
      "Enter your Todoist API token",
    );
    fireEvent.change(tokenInput, { target: { value: "different-token" } });

    // Change token back to original
    fireEvent.change(tokenInput, {
      target: { value: "existing-secure-token" },
    });

    // Save
    const saveButton = screen.getByRole("button", { name: "Save Changes" });
    fireEvent.click(saveButton);

    await waitFor(() => {
      // Ultimately, it matches the initial secure token, so skip encryption
      expect(setSecureToken).not.toHaveBeenCalled();
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

  it("does not fall back to plaintext storage if secure storage fails", async () => {
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
      /* intentionally empty */
    });
    vi.mocked(setSecureToken).mockRejectedValue(
      new Error("Secure store disabled"),
    );

    render(<SettingsView {...defaultProps} />);
    fireEvent.click(screen.getAllByText("Integrations")[0]);

    await waitFor(() => {
      expect(mockStore.get).toHaveBeenCalled();
    });

    const tokenInput = screen.getByPlaceholderText(
      "Enter your Todoist API token",
    );
    fireEvent.change(tokenInput, { target: { value: "new-token-123" } });

    const saveButton = screen.getByRole("button", { name: "Save Changes" });
    fireEvent.click(saveButton);

    await waitFor(() => {
      // Secure store was called but failed
      expect(setSecureToken).toHaveBeenCalledWith(
        "todoist_token",
        "new-token-123",
      );
      expect(mockStore.set).not.toHaveBeenCalledWith(
        "todoist_token",
        "new-token-123",
      );
      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });
    consoleWarnSpy.mockRestore();
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
