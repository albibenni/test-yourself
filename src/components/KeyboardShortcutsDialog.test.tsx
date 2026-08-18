import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { KeyboardShortcutsDialog } from "./KeyboardShortcutsDialog";

describe("KeyboardShortcutsDialog", () => {
  it("describes the available controls and closes with Escape", () => {
    const onClose = vi.fn();
    render(<KeyboardShortcutsDialog isOpen onClose={onClose} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Ctrl/Cmd + F")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps focus in the dialog and restores it when closed", () => {
    const onClose = vi.fn();
    const { rerender } = render(<button type="button">Open guide</button>);
    const trigger = screen.getByRole("button", { name: "Open guide" });
    trigger.focus();

    rerender(
      <>
        <button type="button">Open guide</button>
        <KeyboardShortcutsDialog isOpen onClose={onClose} />
      </>,
    );

    const closeButton = screen.getByRole("button", {
      name: "Close keyboard shortcuts",
    });
    expect(closeButton).toHaveFocus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(closeButton).toHaveFocus();

    fireEvent.click(closeButton);
    rerender(
      <>
        <button type="button">Open guide</button>
        <KeyboardShortcutsDialog isOpen={false} onClose={onClose} />
      </>,
    );

    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Open guide" })).toHaveFocus();
  });
});
