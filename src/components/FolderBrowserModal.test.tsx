import { invoke } from "@tauri-apps/api/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FolderBrowserModal } from "./FolderBrowserModal";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("FolderBrowserModal Component (iOS Directory Search & Navigation)", () => {
  const mockListing = {
    current_path: "/Users/benni/Library/Developer/CoreSimulator/Documents",
    parent_path: "/Users/benni/Library/Developer/CoreSimulator",
    items: [
      {
        name: "Documents",
        path: "/Users/benni/Library/Developer/CoreSimulator/Documents",
        is_dir: true,
        md_count: 5,
      },
      {
        name: "SampleQuizzes",
        path: "/Users/benni/Library/Developer/CoreSimulator/Documents/SampleQuizzes",
        is_dir: true,
        md_count: 12,
      },
      {
        name: "ACID_quiz.md",
        path: "/Users/benni/Library/Developer/CoreSimulator/Documents/ACID_quiz.md",
        is_dir: false,
        md_count: 1,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(invoke).mockResolvedValue(mockListing);
  });

  it("renders directory listing from browse_directory command", async () => {
    render(
      <FolderBrowserModal
        isOpen={true}
        onClose={vi.fn()}
        onSelectFolder={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("browse_directory", { path: null });
    });

    expect(screen.getByText("Browse Folders")).toBeInTheDocument();
    expect(screen.getByText("SampleQuizzes")).toBeInTheDocument();
    expect(screen.getByText("12 quizzes")).toBeInTheDocument();
    expect(screen.queryByText("📂 Project Workspace")).not.toBeInTheDocument();
  });

  it("navigates into subfolder when a folder item is clicked", async () => {
    render(
      <FolderBrowserModal
        isOpen={true}
        onClose={vi.fn()}
        onSelectFolder={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("SampleQuizzes")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("SampleQuizzes"));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("browse_directory", {
        path: "/Users/benni/Library/Developer/CoreSimulator/Documents/SampleQuizzes",
      });
    });
  });

  it("navigates up to parent directory when Up button is clicked", async () => {
    render(
      <FolderBrowserModal
        isOpen={true}
        onClose={vi.fn()}
        onSelectFolder={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Up")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Up"));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("browse_directory", {
        path: "/Users/benni/Library/Developer/CoreSimulator",
      });
    });
  });

  it("navigates directly to iOS Documents via On My iPhone shortcut", async () => {
    render(
      <FolderBrowserModal
        isOpen={true}
        onClose={vi.fn()}
        onSelectFolder={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText("📱 On My iPhone (Documents)"),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("📱 On My iPhone (Documents)"));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("browse_directory", {
        path: "documents",
      });
    });
  });

  it("confirms folder selection when Select This Folder button is clicked", async () => {
    const handleSelectFolder = vi.fn();
    render(
      <FolderBrowserModal
        isOpen={true}
        onClose={vi.fn()}
        onSelectFolder={handleSelectFolder}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Select This Folder")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Select This Folder"));

    expect(handleSelectFolder).toHaveBeenCalledWith(
      "/Users/benni/Library/Developer/CoreSimulator/Documents",
    );
  });

  it("handles empty folder gracefully", async () => {
    vi.mocked(invoke).mockResolvedValueOnce({
      current_path: "/Users/benni/EmptyFolder",
      parent_path: "/Users/benni",
      items: [],
    });

    render(
      <FolderBrowserModal
        isOpen={true}
        onClose={vi.fn()}
        onSelectFolder={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText("No subfolders or quiz files in this folder."),
      ).toBeInTheDocument();
    });
  });

  it("handles directory listing backend error gracefully", async () => {
    vi.mocked(invoke).mockRejectedValueOnce("Cannot access directory");

    render(
      <FolderBrowserModal
        isOpen={true}
        onClose={vi.fn()}
        onSelectFolder={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Cannot access directory")).toBeInTheDocument();
    });
  });
});
