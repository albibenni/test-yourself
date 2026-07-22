/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SettingsModal } from "./SettingsModal";
import { load } from "@tauri-apps/plugin-store";
import { getSecureToken, setSecureToken } from "../utils/secureStore";
import { open } from "@tauri-apps/plugin-dialog";

vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn(),
}));

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

describe("SettingsModal", () => {
  let mockStore: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(window.localStorage.getItem).mockReturnValue(null);
    mockStore = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(true),
      save: vi.fn().mockResolvedValue(true),
      delete: vi.fn().mockResolvedValue(true),
    };
    vi.mocked(load).mockResolvedValue(mockStore);
    vi.mocked(getSecureToken).mockResolvedValue(null);
  });

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    theme: "system" as any,
    accent: "blue" as any,
    textColor: "slate" as any,
    onThemeChange: vi.fn(),
    onAccentChange: vi.fn(),
    onTextColorChange: vi.fn(),
  };

  it("loads secure token if available", async () => {
    vi.mocked(getSecureToken).mockResolvedValue("secure-token-value");

    render(<SettingsModal {...defaultProps} />);

    await waitFor(() => {
      expect(
        screen.getByDisplayValue("secure-token-value"),
      ).toBeInTheDocument();
    });
  });

  it("saves token via secureStore and cleans up localStorage", async () => {
    render(<SettingsModal {...defaultProps} />);

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
    const saveButton = screen.getByRole("button", { name: "Save" });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(setSecureToken).toHaveBeenCalledWith(
        "todoist_token",
        "new-token-123",
      );
      expect(mockStore.delete).toHaveBeenCalledWith("todoist_token"); // Cleans up unencrypted
      expect(mockStore.save).toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it("selects vault folder via dialog", async () => {
    vi.mocked(open).mockResolvedValue("/new/mock/MyVault");

    render(<SettingsModal {...defaultProps} />);

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

  it("does not call setSecureToken if the token has not changed", async () => {
    vi.mocked(getSecureToken).mockResolvedValue("existing-secure-token");

    render(<SettingsModal {...defaultProps} />);

    await waitFor(() => {
      expect(
        screen.getByDisplayValue("existing-secure-token"),
      ).toBeInTheDocument();
    });

    // Change another setting (e.g., Vault Name)
    const browseBtn = screen.getByRole("button", { name: "Browse..." });
    vi.mocked(open).mockResolvedValue("/new/mock/MyVault");
    fireEvent.click(browseBtn);

    await waitFor(() => {
      expect(screen.getByDisplayValue("MyVault")).toBeInTheDocument();
    });

    // Save
    const saveButton = screen.getByRole("button", { name: "Save" });
    fireEvent.click(saveButton);

    await waitFor(() => {
      // The token wasn't modified, so setSecureToken should NOT be called
      expect(setSecureToken).not.toHaveBeenCalled();
      expect(mockStore.set).toHaveBeenCalledWith("obsidian_vault", "MyVault");
      expect(mockStore.save).toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalled();
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

    render(<SettingsModal {...defaultProps} />);

    await waitFor(() => {
      expect(mockStore.get).toHaveBeenCalled();
    });

    const saveButton = screen.getByRole("button", { name: "Save" });

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
});
