import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import App from "./App";
import { invoke } from "@tauri-apps/api/core";
import { load } from "@tauri-apps/plugin-store";
import { open } from "@tauri-apps/plugin-dialog";

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

const mockQuizzes = [
  {
    title: "React Basics",
    path: "/path/react.md",
    topic: "Frontend",
    last_modified: 1234567890,
    questions: [
      {
        id: "1",
        text: "What is React?",
        options: [
          { letter: "A", text: "A library" },
          { letter: "B", text: "A framework" },
        ],
        correct_answer: "A",
        explanation: "React is a UI library.",
      },
      {
        id: "2",
        text: "Who made React?",
        options: [
          { letter: "A", text: "Google" },
          { letter: "B", text: "Facebook" },
        ],
        correct_answer: "B",
        explanation: "Facebook made React.",
      },
    ],
  },
  {
    title: "Rust Basics",
    path: "/path/rust.md",
    topic: "Backend",
    last_modified: 1234567890,
    questions: [],
  },
];

describe("App Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(invoke).mockResolvedValue(mockQuizzes);
    vi.mocked(load).mockResolvedValue({
      get: vi.fn().mockResolvedValue("/mock/path"),
      set: vi.fn().mockResolvedValue(true),
      save: vi.fn().mockResolvedValue(true),
    } as any);
  });

  it("shows loading state initially", async () => {
    // We mock a pending promise to see the loading state
    let resolvePromise: (val: any) => void = () => {};
    vi.mocked(invoke).mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve;
      }),
    );
    render(<App />);
    expect(await screen.findByText("Loading quizzes...")).toBeInTheDocument();

    await act(async () => {
      resolvePromise(mockQuizzes);
      await Promise.resolve(); // satisfy require-await
    });
  });

  it("renders search bar and filters quizzes correctly", async () => {
    render(<App />);

    // Wait for the quizzes to load
    await waitFor(() => {
      expect(screen.getByText("React Basics")).toBeInTheDocument();
      expect(screen.getByText("Rust Basics")).toBeInTheDocument();
    });

    // Find the search input
    const searchInput = screen.getByPlaceholderText(
      "Search by topic or title...",
    );
    expect(searchInput).toBeInTheDocument();

    // Type in the search input to filter by title
    fireEvent.change(searchInput, { target: { value: "React" } });

    // React Basics should be there, Rust Basics should be gone
    expect(screen.getByText("React Basics")).toBeInTheDocument();
    expect(screen.queryByText("Rust Basics")).not.toBeInTheDocument();

    // Type in the search input to filter by topic
    fireEvent.change(searchInput, { target: { value: "Backend" } });

    // Rust Basics should be there, React Basics should be gone
    expect(screen.queryByText("React Basics")).not.toBeInTheDocument();
    expect(screen.getByText("Rust Basics")).toBeInTheDocument();

    // Edge case: No results
    fireEvent.change(searchInput, { target: { value: "NonExistent" } });
    expect(screen.queryByText("React Basics")).not.toBeInTheDocument();
    expect(screen.queryByText("Rust Basics")).not.toBeInTheDocument();
  });

  it("toggles sidebar visibility", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("React Basics")).toBeInTheDocument();
    });

    const toggleButton = screen.getByRole("button", { name: "Toggle Sidebar" });
    // The aside has role="complementary" implicitly
    const sidebar = screen.getByRole("complementary");

    // Initially open (no 'closed' class)
    expect(sidebar).not.toHaveClass("closed");

    // Click to close
    fireEvent.click(toggleButton);
    expect(sidebar).toHaveClass("closed");

    // Click to open
    fireEvent.click(toggleButton);
    expect(sidebar).not.toHaveClass("closed");
  });

  it("selects a quiz and answers questions", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("React Basics")).toBeInTheDocument();
    });

    // Select the quiz
    fireEvent.click(screen.getByText("React Basics"));

    // Check quiz header
    expect(
      screen.getByRole("heading", { name: "React Basics", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText("1. What is React?")).toBeInTheDocument();

    // Answer correctly (Question 1)
    const btnA = screen.getByText("A library").closest("button")!;
    fireEvent.click(btnA);

    expect(screen.getByText("✨ Correct!")).toBeInTheDocument();
    expect(screen.getByText("React is a UI library.")).toBeInTheDocument();

    // Buttons should be disabled
    expect(btnA).toBeDisabled();

    // Answer incorrectly (Question 2)
    const btnA2 = screen.getByText("Google").closest("button")!;
    fireEvent.click(btnA2);

    expect(screen.getByText("❌ Incorrect")).toBeInTheDocument();
    expect(screen.getByText("Facebook made React.")).toBeInTheDocument();
  });

  it("handles invoke errors gracefully", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("Failed to load"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<App />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to load quizzes:",
        expect.any(Error),
      );
    });
    consoleSpy.mockRestore();
  });

  it("shows Select Quiz Folder when no directory is configured", async () => {
    vi.mocked(load).mockResolvedValue({
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(true),
      save: vi.fn().mockResolvedValue(true),
    } as any);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Select Quiz Folder")).toBeInTheDocument();
    });
  });

  it("allows selecting a new folder from TopBar", async () => {
    vi.mocked(open).mockResolvedValue("/new/mock/path");

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("React Basics")).toBeInTheDocument();
    });

    const changeFolderBtn = screen.getByRole("button", {
      name: "Change Folder",
    });
    fireEvent.click(changeFolderBtn);

    await waitFor(() => {
      expect(open).toHaveBeenCalledWith({ directory: true, multiple: false });
    });
  });
});
