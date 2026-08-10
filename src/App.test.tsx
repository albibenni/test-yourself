import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { load } from "@tauri-apps/plugin-store";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

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

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-deep-link", () => ({
  onOpenUrl: vi.fn().mockResolvedValue(vi.fn()),
  getCurrent: vi.fn().mockResolvedValue(null),
}));

vi.mock("@tauri-apps/plugin-os", () => ({
  type: vi.fn().mockReturnValue("linux"),
}));

export let mockListenCallback: (event: { payload: string }) => void = () => {
  /* intentionally empty */
};

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn((event: string, cb: (e: { payload: string }) => void) => {
    if (event === "deep-link-received") {
      mockListenCallback = cb;
    }
    return Promise.resolve(vi.fn());
  }),
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
    vi.mocked(invoke).mockImplementation((cmd: string, args?: unknown) => {
      if (cmd === "get_quizzes") return Promise.resolve(mockQuizzes);
      if (cmd === "get_quiz_content") {
        const path = (args as { path?: string })?.path;
        return Promise.resolve(
          mockQuizzes.find((q) => q.path === path) || null,
        );
      }
      if (cmd === "get_initial_url") return Promise.resolve(null);
      return Promise.resolve(null);
    });
    vi.mocked(load).mockResolvedValue({
      get: vi.fn().mockResolvedValue("/mock/path"),
      set: vi.fn().mockResolvedValue(true),
      save: vi.fn().mockResolvedValue(true),
    } as unknown as Awaited<ReturnType<typeof load>>);
  });

  it("shows loading state initially", async () => {
    // We mock a pending promise to see the loading state
    let resolvePromise: (val: unknown) => void = () => {
      /* intentionally empty */
    };
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "get_quizzes") {
        return new Promise((resolve) => {
          resolvePromise = resolve;
        });
      }
      return Promise.resolve(null);
    });
    render(<App />);
    expect(await screen.findByText("Loading...")).toBeInTheDocument();

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
    const searchInput = screen.getByPlaceholderText("Search...");
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

    const toggleButton = screen.getAllByRole("button", {
      name: "Toggle Sidebar",
    })[0];
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
    expect(await screen.findByText("1. What is React?")).toBeInTheDocument();

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
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {
      /* intentionally empty */
    });

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
    } as unknown as Awaited<ReturnType<typeof load>>);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Select Quiz Folder")).toBeInTheDocument();
    });
  });

  it("allows selecting a new folder from Settings", async () => {
    vi.mocked(open).mockResolvedValue("/new/mock/path");

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("React Basics")).toBeInTheDocument();
    });

    const settingsBtn = screen.getAllByRole("button", { name: "Settings" })[0];
    fireEvent.click(settingsBtn);

    await waitFor(() => {
      expect(screen.getByText("Quiz Directory")).toBeInTheDocument();
    });

    const changeFolderBtn = screen.getByRole("button", {
      name: "Browse...",
    });
    fireEvent.click(changeFolderBtn);

    await waitFor(() => {
      expect(open).toHaveBeenCalledWith({ directory: true, multiple: false });
    });
  });

  it("opens Obsidian with absolute path when clicking the Topic link", async () => {
    const { openUrl } = await import("@tauri-apps/plugin-opener");

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("React Basics")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("React Basics"));

    const topicLink = await screen.findByRole("link", {
      name: "Open topic Frontend",
    });
    fireEvent.click(topicLink);

    expect(openUrl).toHaveBeenCalledWith(
      "obsidian://open?path=%2Fpath%2Freact.md",
    );
  });

  it("opens a quiz when launched with deep link (get_initial_url)", async () => {
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "get_quizzes") return Promise.resolve(mockQuizzes);
      if (cmd === "get_quiz_content") return Promise.resolve(mockQuizzes[0]);
      // Mock the initial URL containing the deep link to React Basics
      if (cmd === "get_initial_url")
        return Promise.resolve("test-yourself://open?quiz=%2Fpath%2Freact.md");
      return Promise.resolve(null);
    });

    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "React Basics", level: 1 }),
      ).toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText("Search...")).toHaveValue("");
  });

  it("opens a quiz when receiving deep-link-received event", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("React Basics")).toBeInTheDocument();
    });

    // Simulate the secondary instance forwarding the deep link
    act(() => {
      mockListenCallback({
        payload: "test-yourself://open?quiz=%2Fpath%2Freact.md",
      });
    });

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "React Basics", level: 1 }),
      ).toBeInTheDocument();
    });
  });

  it("preserves quiz state when settings are opened and closed", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("React Basics")).toBeInTheDocument();
    });

    // Select the quiz
    fireEvent.click(screen.getByText("React Basics"));

    await waitFor(() => {
      expect(screen.getByText("1. What is React?")).toBeInTheDocument();
    });

    // Answer correctly (Question 1)
    const btnA = screen.getByText("A library").closest("button")!;
    fireEvent.click(btnA);

    // Verify it was answered
    expect(screen.getByText("✨ Correct!")).toBeInTheDocument();
    expect(btnA).toBeDisabled();

    // Open settings
    const settingsBtn = screen.getAllByRole("button", { name: "Settings" })[0];
    fireEvent.click(settingsBtn);

    // Verify Settings is opened by looking for Settings title
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Settings" }),
      ).toBeInTheDocument();
    });

    // Check if the question is visually hidden but still in DOM
    const questionEl = screen.getByText("1. What is React?");
    expect(questionEl).toBeInTheDocument();

    // Close settings
    const cancelBtn = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(cancelBtn);

    // Verify Settings is closed
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "Settings" }),
      ).not.toBeInTheDocument();
    });

    // Verify the state is preserved (still says Correct and disabled)
    expect(screen.getByText("✨ Correct!")).toBeInTheDocument();
    const btnAAfter = screen.getByText("A library").closest("button")!;
    expect(btnAAfter).toBeDisabled();
  });

  // ─── Deep link: parseDeepLinkUrl & path-matching ────────────────────────────

  it("opens quiz via deep link with %2F-encoded path (Todoist-style URL)", async () => {
    // Todoist encodes slashes as %2F in query params
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "get_quizzes") return Promise.resolve(mockQuizzes);
      if (cmd === "get_quiz_content") return Promise.resolve(mockQuizzes[0]);
      if (cmd === "get_initial_url")
        return Promise.resolve(
          "test-yourself://open?quiz=Frontend%2FReact%20Basics.md",
        );
      return Promise.resolve(null);
    });

    // React quiz path matches 'Frontend/React Basics.md' via endsWith
    const todoistQuizzes = [
      {
        ...mockQuizzes[0],
        path: "/Users/benni/SecondBrain/Frontend/React Basics.md",
        topic: "Frontend",
        title: "React Basics",
      },
      mockQuizzes[1],
    ];
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "get_quizzes") return Promise.resolve(todoistQuizzes);
      if (cmd === "get_quiz_content") return Promise.resolve(todoistQuizzes[0]);
      if (cmd === "get_initial_url")
        return Promise.resolve(
          "test-yourself://open?quiz=Frontend%2FReact%20Basics.md",
        );
      return Promise.resolve(null);
    });

    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "React Basics", level: 1 }),
      ).toBeInTheDocument();
    });
  });

  it("opens quiz via deep-link-received with %2F-encoded path", async () => {
    // Simulate the Rust single-instance plugin forwarding a Todoist-style URL
    const nestedQuizzes = [
      {
        ...mockQuizzes[0],
        path: "/Users/benni/SecondBrain/Computer Science/Web/React Basics.md",
        topic: "Computer Science/Web",
        title: "React Basics",
      },
      mockQuizzes[1],
    ];
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "get_quizzes") return Promise.resolve(nestedQuizzes);
      if (cmd === "get_quiz_content") return Promise.resolve(nestedQuizzes[0]);
      if (cmd === "get_initial_url") return Promise.resolve(null);
      return Promise.resolve(null);
    });

    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("React Basics")).toBeInTheDocument();
    });

    act(() => {
      mockListenCallback({
        payload:
          "test-yourself://open?quiz=Computer%20Science%2FWeb%2FReact%20Basics.md",
      });
    });

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "React Basics", level: 1 }),
      ).toBeInTheDocument();
    });
  });

  it("opens quiz by filename stem match (no extension in link)", async () => {
    // Deep link uses just the stem: react_basics (no .md)
    // This tests Tier-3 stem matching
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "get_quizzes") return Promise.resolve(mockQuizzes);
      if (cmd === "get_quiz_content") return Promise.resolve(mockQuizzes[0]);
      if (cmd === "get_initial_url") return Promise.resolve(null);
      return Promise.resolve(null);
    });

    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("React Basics")).toBeInTheDocument();
    });

    act(() => {
      // Stem of /path/react.md is 'react'
      mockListenCallback({
        payload: "test-yourself://open?quiz=react.md",
      });
    });

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "React Basics", level: 1 }),
      ).toBeInTheDocument();
    });
  });

  it("opens quiz case-insensitively via deep link", async () => {
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "get_quizzes") return Promise.resolve(mockQuizzes);
      if (cmd === "get_quiz_content") return Promise.resolve(mockQuizzes[0]);
      if (cmd === "get_initial_url") return Promise.resolve(null);
      return Promise.resolve(null);
    });

    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("React Basics")).toBeInTheDocument();
    });

    act(() => {
      // REACT.MD (uppercase) should match /path/react.md via case-insensitive endsWith
      mockListenCallback({
        payload: "test-yourself://open?quiz=REACT.MD",
      });
    });

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "React Basics", level: 1 }),
      ).toBeInTheDocument();
    });
  });

  it("shows not-found toast when deep link quiz does not exist in library", async () => {
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "get_quizzes") return Promise.resolve(mockQuizzes);
      if (cmd === "get_initial_url") return Promise.resolve(null);
      return Promise.resolve(null);
    });

    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {
      /* intentionally empty */
    });

    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("React Basics")).toBeInTheDocument();
    });

    act(() => {
      mockListenCallback({
        payload: "test-yourself://open?quiz=nonexistent_quiz.md",
      });
    });

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        expect.stringContaining("nonexistent_quiz.md"),
      );
    });

    alertSpy.mockRestore();
  });

  it("handles deep link with deeply-nested %2F path from ScheduleModal format", async () => {
    // Exactly replicates what ScheduleModal builds:
    // topic/title.md → encoded as topic%2Ftitle.md
    const deepPath =
      "/Users/benni/SecondBrain/Computer Science/Security/Authentication/Exercises and Quiz/spiffe_quiz.md";
    const deepTopic =
      "Computer Science/Security/Authentication/Exercises and Quiz";
    const deepTitle = "spiffe_quiz";

    // QuizMetadata shape (returned by get_quizzes)
    const deepMeta = {
      title: deepTitle,
      path: deepPath,
      topic: deepTopic,
      last_modified: 1234567890,
      is_worksheet: false,
    };
    // Quiz shape (returned by get_quiz_content — must match QuizSchema exactly)
    const deepQuizContent = {
      title: deepTitle,
      path: deepPath,
      topic: deepTopic,
      last_modified: 1234567890,
      questions: [
        {
          id: "1",
          text: "What is SPIFFE?",
          options: [
            { letter: "A", text: "A standard" },
            { letter: "B", text: "A library" },
          ],
          correct_answer: "A",
          explanation: "SPIFFE is an identity standard.",
        },
      ],
    };

    const alertCalls: string[] = [];
    const alertSpy = vi
      .spyOn(window, "alert")
      .mockImplementation((msg) => alertCalls.push(String(msg)));

    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "get_quizzes") return Promise.resolve([deepMeta]);
      if (cmd === "get_quiz_content") return Promise.resolve(deepQuizContent);
      if (cmd === "get_initial_url")
        return Promise.resolve(
          "test-yourself://open?quiz=Computer%20Science%2FSecurity%2FAuthentication%2FExercises%20and%20Quiz%2Fspiffe_quiz.md",
        );
      return Promise.resolve(null);
    });

    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", {
          name: deepTitle.replace(/_/g, " "),
          level: 1,
        }),
      ).toBeInTheDocument();
    });

    // No alert should fire (no parse errors)
    expect(alertCalls).toEqual([]);
    alertSpy.mockRestore();
  });

  it("onOpenUrl callback opens the correct quiz", async () => {
    const { onOpenUrl } = await import("@tauri-apps/plugin-deep-link");
    let capturedCallback: ((urls: string[]) => void) | null = null;

    vi.mocked(onOpenUrl).mockImplementation(async (cb) => {
      await Promise.resolve();
      capturedCallback = cb as (urls: string[]) => void;
      return vi.fn();
    });

    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "get_quizzes") return Promise.resolve(mockQuizzes);
      if (cmd === "get_quiz_content") return Promise.resolve(mockQuizzes[0]);
      if (cmd === "get_initial_url") return Promise.resolve(null);
      return Promise.resolve(null);
    });

    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("React Basics")).toBeInTheDocument();
    });

    // Simulate macOS delivering the URL via the deep-link plugin
    act(() => {
      capturedCallback?.(["test-yourself://open?quiz=%2Fpath%2Freact.md"]);
    });

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "React Basics", level: 1 }),
      ).toBeInTheDocument();
    });
  });
});
