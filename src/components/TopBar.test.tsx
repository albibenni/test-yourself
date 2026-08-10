import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TopBar } from "./TopBar";

describe("TopBar Component", () => {
  it("renders the title and buttons", () => {
    const setIsSidebarOpen = vi.fn();

    render(
      <TopBar
        isSidebarOpen={true}
        setIsSidebarOpen={setIsSidebarOpen}
        onOpenSettings={vi.fn()}
      />,
    );

    expect(screen.getByText("Test Yourself")).toBeInTheDocument();

    const toggleBtn = screen.getByRole("button", { name: "Toggle Sidebar" });
    expect(toggleBtn).toBeInTheDocument();

    const settingsBtn = screen.getByRole("button", { name: "Settings" });
    expect(settingsBtn).toBeInTheDocument();
  });

  it("calls setIsSidebarOpen when toggle button is clicked", () => {
    const setIsSidebarOpen = vi.fn();

    render(
      <TopBar
        isSidebarOpen={true}
        setIsSidebarOpen={setIsSidebarOpen}
        onOpenSettings={vi.fn()}
      />,
    );

    const toggleBtn = screen.getByRole("button", { name: "Toggle Sidebar" });
    fireEvent.click(toggleBtn);
    expect(setIsSidebarOpen).toHaveBeenCalledWith(false); // Because it was true
  });
});
