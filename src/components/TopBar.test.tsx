import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TopBar } from "./TopBar";

describe("TopBar Component", () => {
  const originalPlatform = navigator.platform;
  const originalUserAgent = navigator.userAgent;

  afterEach(() => {
    vi.spyOn(navigator, "platform", "get").mockReturnValue(originalPlatform);
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(originalUserAgent);
    vi.restoreAllMocks();
  });

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

  it("adds the macOS title-bar spacing class on macOS", () => {
    vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0");

    const { container } = render(
      <TopBar
        isSidebarOpen={true}
        setIsSidebarOpen={vi.fn()}
        onOpenSettings={vi.fn()}
      />,
    );

    expect(container.firstChild).toHaveClass("top-bar--macos");
  });

  it("does not add macOS title-bar spacing on other desktop platforms", () => {
    vi.spyOn(navigator, "platform", "get").mockReturnValue("Win32");
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0");

    const { container } = render(
      <TopBar
        isSidebarOpen={true}
        setIsSidebarOpen={vi.fn()}
        onOpenSettings={vi.fn()}
      />,
    );

    expect(container.firstChild).not.toHaveClass("top-bar--macos");
  });
});
