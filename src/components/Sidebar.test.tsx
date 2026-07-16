import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Sidebar } from "./Sidebar";
import type { Quiz } from "../types";

const mockQuizzes: Record<string, Quiz[]> = {
  Frontend: [
    {
      title: "React Basics",
      path: "/react.md",
      topic: "Frontend",
      questions: [],
      last_modified: 0,
    },
  ],
  Backend: [
    {
      title: "Rust Basics",
      path: "/rust.md",
      topic: "Backend",
      questions: [],
      last_modified: 0,
    },
  ],
};

describe("Sidebar Component", () => {
  it("renders grouped quizzes correctly", () => {
    render(
      <Sidebar
        isSidebarOpen={true}
        searchQuery=""
        setSearchQuery={vi.fn()}
        loading={false}
        groupedQuizzes={mockQuizzes}
        selectedQuiz={null}
        setSelectedQuiz={vi.fn()}
        handleSync={vi.fn()}
        isSyncing={false}
      />,
    );

    expect(screen.getByText("Frontend")).toBeInTheDocument();
    expect(screen.getByText("React Basics")).toBeInTheDocument();
    expect(screen.getByText("Backend")).toBeInTheDocument();
    expect(screen.getByText("Rust Basics")).toBeInTheDocument();
  });

  it("shows loading state when loading is true", () => {
    render(
      <Sidebar
        isSidebarOpen={true}
        searchQuery=""
        setSearchQuery={vi.fn()}
        loading={true}
        groupedQuizzes={{}}
        selectedQuiz={null}
        setSelectedQuiz={vi.fn()}
        handleSync={vi.fn()}
        isSyncing={false}
      />,
    );

    expect(screen.getByText("Loading quizzes...")).toBeInTheDocument();
  });

  it("shows empty state when there are no quizzes and no search query", () => {
    render(
      <Sidebar
        isSidebarOpen={true}
        searchQuery=""
        setSearchQuery={vi.fn()}
        loading={false}
        groupedQuizzes={{}}
        selectedQuiz={null}
        setSelectedQuiz={vi.fn()}
        handleSync={vi.fn()}
        isSyncing={false}
      />,
    );

    expect(
      screen.getByText("No quizzes found in this folder."),
    ).toBeInTheDocument();
  });

  it("shows empty state when search yields no results", () => {
    render(
      <Sidebar
        isSidebarOpen={true}
        searchQuery="Angular"
        setSearchQuery={vi.fn()}
        loading={false}
        groupedQuizzes={{}}
        selectedQuiz={null}
        setSelectedQuiz={vi.fn()}
        handleSync={vi.fn()}
        isSyncing={false}
      />,
    );

    expect(
      screen.getByText("No quizzes match your search."),
    ).toBeInTheDocument();
  });

  it("calls setSearchQuery on input change", () => {
    const setSearchQuery = vi.fn();
    render(
      <Sidebar
        isSidebarOpen={true}
        searchQuery=""
        setSearchQuery={setSearchQuery}
        loading={false}
        groupedQuizzes={mockQuizzes}
        selectedQuiz={null}
        setSelectedQuiz={vi.fn()}
        handleSync={vi.fn()}
        isSyncing={false}
      />,
    );

    const input = screen.getByPlaceholderText("Search by topic or title...");
    fireEvent.change(input, { target: { value: "React" } });
    expect(setSearchQuery).toHaveBeenCalledWith("React");
  });

  it("calls setSelectedQuiz when a quiz is clicked", () => {
    const setSelectedQuiz = vi.fn();
    render(
      <Sidebar
        isSidebarOpen={true}
        searchQuery=""
        setSearchQuery={vi.fn()}
        loading={false}
        groupedQuizzes={mockQuizzes}
        selectedQuiz={null}
        setSelectedQuiz={setSelectedQuiz}
        handleSync={vi.fn()}
        isSyncing={false}
      />,
    );

    fireEvent.click(screen.getByText("React Basics"));
    expect(setSelectedQuiz).toHaveBeenCalledWith(mockQuizzes["Frontend"][0]);
  });

  it("calls handleSync when sync button is clicked", () => {
    const handleSync = vi.fn();
    render(
      <Sidebar
        isSidebarOpen={true}
        searchQuery=""
        setSearchQuery={vi.fn()}
        loading={false}
        groupedQuizzes={mockQuizzes}
        selectedQuiz={null}
        setSelectedQuiz={vi.fn()}
        handleSync={handleSync}
        isSyncing={false}
      />,
    );

    const syncBtn = screen.getByRole("button", { name: "Sync Quizzes" });
    fireEvent.click(syncBtn);
    expect(handleSync).toHaveBeenCalledOnce();
  });
});
