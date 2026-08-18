import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { QuizMetadata } from "../types";
import { Sidebar } from "./Sidebar";

const mockQuizzes: Record<string, QuizMetadata[]> = {
  Frontend: [
    {
      title: "React Basics",
      path: "/react.md",
      topic: "Frontend",
      last_modified: 0,
    },
  ],
  Backend: [
    {
      title: "Rust Basics",
      path: "/rust.md",
      topic: "Backend",
      last_modified: 0,
    },
  ],
};

const scenario = {
  title: "SPIFFE-SPIRE and mTLS",
  path: "/SPIFFE-SPIRE and mTLS.scenario.md",
  topic: "Security",
  last_modified: 0,
  is_scenario: true,
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
        setIsSidebarOpen={vi.fn()}
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
        setIsSidebarOpen={vi.fn()}
      />,
    );

    expect(screen.getByText("Loading...")).toBeInTheDocument();
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
        setIsSidebarOpen={vi.fn()}
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
        setIsSidebarOpen={vi.fn()}
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
        setIsSidebarOpen={vi.fn()}
      />,
    );

    const input = screen.getByPlaceholderText("Search...");
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
        setIsSidebarOpen={vi.fn()}
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
        setIsSidebarOpen={vi.fn()}
      />,
    );

    const syncBtn = screen.getByRole("button", { name: "Sync Quizzes" });
    fireEvent.click(syncBtn);
    expect(handleSync).toHaveBeenCalledOnce();
  });

  it("shows scenario files only in the Scenarios tab", () => {
    render(
      <Sidebar
        isSidebarOpen={true}
        searchQuery=""
        setSearchQuery={vi.fn()}
        loading={false}
        groupedQuizzes={{ Security: [scenario] }}
        selectedQuiz={null}
        setSelectedQuiz={vi.fn()}
        handleSync={vi.fn()}
        isSyncing={false}
        setIsSidebarOpen={vi.fn()}
      />,
    );

    expect(screen.queryByText(scenario.title)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Scenarios" }));
    expect(screen.getByText(scenario.title)).toBeInTheDocument();
  });
});
