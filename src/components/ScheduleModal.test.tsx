/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ScheduleModal } from "./ScheduleModal";
import * as useTodoistModule from "../hooks/useTodoist";

vi.mock("../hooks/useTodoist", () => ({
  useTodoist: vi.fn(),
}));

describe("ScheduleModal", () => {
  let mockGetProjects: any;
  let mockGetTasks: any;
  let mockAddTask: any;
  let mockGetVaultName: any;
  let mockGetDefaultSettings: any;

  const mockQuiz = {
    title: "React Basics",
    path: "/path/react.md",
    topic: "Frontend",
    last_modified: 1234567890,
    questions: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockGetProjects = vi.fn().mockResolvedValue([{ id: "p1", name: "Inbox" }]);
    mockGetTasks = vi.fn().mockResolvedValue([]);
    mockAddTask = vi.fn().mockResolvedValue({ id: "t1" });
    mockGetVaultName = vi.fn().mockResolvedValue("MyVault");
    mockGetDefaultSettings = vi.fn().mockResolvedValue({
      defaultDate: "tomorrow",
      defaultPriority: 4,
      defaultProject: "p1",
    });

    vi.mocked(useTodoistModule.useTodoist).mockReturnValue({
      getProjects: mockGetProjects,
      getTasks: mockGetTasks,
      addTask: mockAddTask,
      getVaultName: mockGetVaultName,
      getDefaultSettings: mockGetDefaultSettings,
      loading: false,
      error: "",
      setError: vi.fn(),
    });
  });

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    quiz: mockQuiz,
    onSuccess: vi.fn(),
  };

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
      expect(mockGetVaultName).toHaveBeenCalled();
      expect(mockAddTask).toHaveBeenCalledWith({
        content: "Review Quiz: React Basics",
        description:
          "[Open in Obsidian](obsidian://open?vault=MyVault&file=Frontend%2FReact%20Basics.md)",
        dueString: expect.any(String), // e.g. "2026-07-22"
        priority: 4,
        projectId: "p1",
      });
      expect(defaultProps.onClose).toHaveBeenCalled();
      expect(defaultProps.onSuccess).toHaveBeenCalled();
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

    const addTaskCall = mockAddTask.mock.calls[0][0];
    
    // Calculate expected date (7 days from now)
    const d = new Date();
    d.setDate(d.getDate() + 7);
    const expectedDateString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    expect(addTaskCall.dueString).toBe(expectedDateString);
  });
});
