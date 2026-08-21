/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import * as useTodoistModule from "../hooks/useTodoist";
import { ScheduleModal } from "./ScheduleModal";

vi.mock("../hooks/useTodoist", () => ({
  useTodoist: vi.fn(),
}));

describe("ScheduleModal", () => {
  let mockGetProjects: Mock;
  let mockGetTasks: Mock;
  let mockSearchTasks: Mock;
  let mockAddTask: Mock;
  let mockGetDefaultSettings: Mock;
  let mockOnCheckResult: Mock;

  const mockQuiz = {
    title: "React Basics",
    path: "/path/react.md",
    topic: "Frontend",
    last_modified: 1234567890,
    questions: [],
  };

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    quiz: mockQuiz,
    onSuccess: vi.fn(),
    onCheckResult: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockGetProjects = vi.fn().mockResolvedValue([{ id: "p1", name: "Inbox" }]);
    mockGetTasks = vi.fn().mockResolvedValue([]);
    mockSearchTasks = vi.fn().mockResolvedValue([]);
    mockAddTask = vi.fn().mockResolvedValue({ id: "t1" });
    mockOnCheckResult = vi.fn();
    defaultProps.onCheckResult = mockOnCheckResult;
    mockGetDefaultSettings = vi.fn().mockResolvedValue({
      defaultDate: "tomorrow",
      defaultPriority: 4,
      defaultProject: "p1",
    });

    vi.mocked(useTodoistModule.useTodoist).mockReturnValue({
      getProjects: mockGetProjects,
      getTasks: mockGetTasks,
      searchTasks: mockSearchTasks,
      addTask: mockAddTask,
      getDefaultSettings: mockGetDefaultSettings,
      loading: false,
      error: "",
      setError: vi.fn(),
    });
  });

  it("renders correctly with quiz details and fetches defaults", async () => {
    render(<ScheduleModal {...defaultProps} />);

    await waitFor(() => {
      expect(mockGetProjects).toHaveBeenCalled();
      expect(mockGetTasks).toHaveBeenCalled();
      expect(mockGetDefaultSettings).toHaveBeenCalled();
    });

    expect(
      screen.getByDisplayValue("Review Quiz: React Basics"),
    ).toBeInTheDocument();
  });

  it("parses smart text for priority and date", async () => {
    render(<ScheduleModal {...defaultProps} />);

    await waitFor(() => {
      expect(mockGetDefaultSettings).toHaveBeenCalled();
    });

    const input = screen.getByPlaceholderText("Task name");

    fireEvent.change(input, {
      target: { value: "Review Quiz: React Basics p1 tod " },
    });

    // "tod" and "p1" should be removed from the value due to parsing
    expect(
      screen.getByDisplayValue("Review Quiz: React Basics"),
    ).toBeInTheDocument();

    // Check if UI reflects Priority 1 and Today (since priority 1 is API 4 and default is 4, but let's check text)
    expect(screen.getByText("Priority 1")).toBeInTheDocument();
    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  it("submits the task with correct payload", async () => {
    render(<ScheduleModal {...defaultProps} />);

    await waitFor(() => {
      expect(mockGetDefaultSettings).toHaveBeenCalled();
    });

    const addBtn = screen.getByRole("button", { name: "Add Task" });
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(mockAddTask).toHaveBeenCalledWith({
        content: "Review Quiz: React Basics",
        description:
          "[Open Quiz](test-yourself://open?quiz=Frontend%2FReact%20Basics.md)",
        dueString: expect.any(String), // e.g. "2026-07-22"
        priority: 4,
        projectId: "p1",
      });
      expect(defaultProps.onClose).toHaveBeenCalled();
      expect(defaultProps.onSuccess).toHaveBeenCalled();
    });
  });

  it("schedules a scenario with its .scenario.md deep link", async () => {
    render(
      <ScheduleModal
        {...defaultProps}
        quiz={{
          ...mockQuiz,
          title: "SPIFFE-SPIRE and mTLS",
          topic: "Computer Science/Security/Authentication",
          is_scenario: true,
        }}
      />,
    );

    await waitFor(() => expect(mockGetDefaultSettings).toHaveBeenCalled());
    expect(
      screen.getByDisplayValue("Review Scenario: SPIFFE-SPIRE and mTLS"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add Task" }));

    await waitFor(() => {
      expect(mockAddTask).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "Review Scenario: SPIFFE-SPIRE and mTLS",
          description:
            "[Open Quiz](test-yourself://open?quiz=Computer%20Science%2FSecurity%2FAuthentication%2FSPIFFE-SPIRE%20and%20mTLS.scenario.md)",
        }),
      );
    });
  });

  it("does not reset the date when typing '1w' and then hitting Enter", async () => {
    // To properly simulate the bug where useTodoist might return a new instance of getDefaultSettings on re-render
    // we could dynamically return a new mock, but the main goal is to test the '1w' parsing and submit.
    render(<ScheduleModal {...defaultProps} />);

    await waitFor(() => {
      expect(mockGetDefaultSettings).toHaveBeenCalled();
    });

    const input = screen.getByPlaceholderText("Task name");

    fireEvent.change(input, {
      target: { value: "Review Quiz: React Basics 1w " },
    });

    // "1w" should be removed from the value due to parsing
    expect(
      screen.getByDisplayValue("Review Quiz: React Basics"),
    ).toBeInTheDocument();

    // Check if UI reflects In 1 Week
    expect(screen.getByText("In 1 Week")).toBeInTheDocument();

    // Simulate Enter press
    fireEvent.keyDown(input, { key: "Enter", code: "Enter", charCode: 13 });

    await waitFor(() => {
      expect(mockAddTask).toHaveBeenCalled();
    });

    const addTaskCall = mockAddTask.mock.calls[0][0] as { dueString?: string };

    // Calculate expected date (7 days from now)
    const d = new Date();
    d.setDate(d.getDate() + 7);
    const expectedDateString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    expect(addTaskCall.dueString).toBe(expectedDateString);
  });

  describe("Check Schedule Button", () => {
    it("falls back to all active tasks when the Todoist search filter finds no exact match", async () => {
      mockGetTasks.mockResolvedValue([]);
      render(<ScheduleModal {...defaultProps} />);

      await waitFor(() => {
        expect(mockGetDefaultSettings).toHaveBeenCalled();
      });

      const checkBtn = screen.getByRole("button", { name: "Check" });
      fireEvent.click(checkBtn);

      await waitFor(() => {
        expect(mockSearchTasks).toHaveBeenCalledWith("React Basics");
        expect(mockGetTasks).toHaveBeenCalledTimes(2);
      });

      expect(mockOnCheckResult).toHaveBeenCalledWith(
        "Not currently scheduled.",
      );
    });

    it("shows dates for exact task-title matches from the Todoist filter", async () => {
      mockSearchTasks.mockResolvedValue([
        { content: "Review Quiz: React Basics", due: { date: "2026-08-20" } },
        { content: "Review Quiz: React Basics", due: { date: "2026-08-25" } },
        {
          content: "Review Quiz: React Basics - Advanced",
          due: { date: "2026-09-01" },
        },
      ]);
      render(<ScheduleModal {...defaultProps} />);

      await waitFor(() => {
        expect(mockGetDefaultSettings).toHaveBeenCalled();
      });

      const checkBtn = screen.getByRole("button", { name: "Check" });
      fireEvent.click(checkBtn);

      await waitFor(() => {
        expect(mockSearchTasks).toHaveBeenCalledWith("React Basics");
      });

      expect(mockOnCheckResult).toHaveBeenCalledWith(
        "Already scheduled for: 2026-08-20, 2026-08-25",
      );
      expect(mockGetTasks).toHaveBeenCalledTimes(1);
    });

    it("uses the all-tasks fallback when the Todoist filter misses an exact title", async () => {
      mockSearchTasks.mockResolvedValue([]);
      mockGetTasks.mockResolvedValue([
        { content: "Review Quiz: React Basics", due: { date: "2026-08-20" } },
      ]);
      render(<ScheduleModal {...defaultProps} />);

      const checkBtn = await screen.findByRole("button", { name: "Check" });
      fireEvent.click(checkBtn);

      await waitFor(() => {
        expect(mockGetTasks).toHaveBeenCalledTimes(2);
      });
      expect(mockOnCheckResult).toHaveBeenCalledWith(
        "Already scheduled for: 2026-08-20",
      );
    });
  });
});
