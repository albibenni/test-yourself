import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TopBar } from "./TopBar";

describe("TopBar Component", () => {
  it("renders the title and buttons", () => {
    const setIsSidebarOpen = vi.fn();
    const selectFolder = vi.fn();

    render(
      <TopBar
        isSidebarOpen={true}
        setIsSidebarOpen={setIsSidebarOpen}
        selectFolder={selectFolder}
      />
    );

    expect(screen.getByText("Test Yourself")).toBeInTheDocument();
    
    const toggleBtn = screen.getByRole("button", { name: "Toggle Sidebar" });
    expect(toggleBtn).toBeInTheDocument();
    
    const changeFolderBtn = screen.getByRole("button", { name: "Change Folder" });
    expect(changeFolderBtn).toBeInTheDocument();
  });

  it("calls setIsSidebarOpen when toggle button is clicked", () => {
    const setIsSidebarOpen = vi.fn();
    const selectFolder = vi.fn();

    render(
      <TopBar
        isSidebarOpen={true}
        setIsSidebarOpen={setIsSidebarOpen}
        selectFolder={selectFolder}
      />
    );

    const toggleBtn = screen.getByRole("button", { name: "Toggle Sidebar" });
    fireEvent.click(toggleBtn);
    expect(setIsSidebarOpen).toHaveBeenCalledWith(false); // Because it was true
  });

  it("calls selectFolder when change folder button is clicked", () => {
    const setIsSidebarOpen = vi.fn();
    const selectFolder = vi.fn();

    render(
      <TopBar
        isSidebarOpen={false}
        setIsSidebarOpen={setIsSidebarOpen}
        selectFolder={selectFolder}
      />
    );

    const changeFolderBtn = screen.getByRole("button", { name: "Change Folder" });
    fireEvent.click(changeFolderBtn);
    expect(selectFolder).toHaveBeenCalledOnce();
  });
});
