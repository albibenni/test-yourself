/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/unbound-method, @typescript-eslint/no-explicit-any, @typescript-eslint/require-await, @typescript-eslint/no-unsafe-argument */
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
});
