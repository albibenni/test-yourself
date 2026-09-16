import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Task } from "../providers/TaskProvider";
import { ScheduleManagementDialog } from "./ScheduleManagementDialog";

const tasks = [
  {
    id: "t1",
    content: "Review Quiz: React Basics",
    due: { date: "2026-08-20" },
    project_id: "p1",
  },
  {
    id: "t2",
    content: "Review Quiz: React Basics",
    due: { date: "2026-08-25" },
    project_id: "p2",
  },
];

const projects = [
  { id: "p1", name: "Inbox" },
  { id: "p2", name: "Learning" },
];

describe("ScheduleManagementDialog", () => {
  it("requires confirmation before deleting a selected schedule", async () => {
    const deleteTask = vi.fn().mockResolvedValue(undefined);
    render(
      <ScheduleManagementDialog
        tasks={tasks}
        projects={projects}
        onClose={vi.fn()}
        onDeleteTask={deleteTask}
        onTasksChange={vi.fn()}
        onResult={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Select schedule due 2026-08-20",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Delete selected (1)" }),
    );

    expect(
      screen.getByRole("heading", { name: "Delete schedule?" }),
    ).toBeInTheDocument();
    expect(screen.getByText("2026-08-20")).toBeInTheDocument();
    expect(deleteTask).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Delete 1 schedule" }));

    await waitFor(() => expect(deleteTask).toHaveBeenCalledWith("t1"));
  });

  it("removes successful deletions and keeps failed schedules selected", async () => {
    const deleteTask = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Todoist unavailable"));
    const onResult = vi.fn();
    const onAllDeleted = vi.fn();

    function Harness() {
      const [currentTasks, setCurrentTasks] = useState<Task[]>(tasks);
      return (
        <ScheduleManagementDialog
          tasks={currentTasks}
          projects={projects}
          onClose={vi.fn()}
          onDeleteTask={deleteTask}
          onTasksChange={setCurrentTasks}
          onResult={onResult}
          onAllDeleted={onAllDeleted}
        />
      );
    }

    render(<Harness />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Delete selected (2)" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete 2 schedules" }));

    await waitFor(() => {
      expect(screen.queryByText("2026-08-20")).not.toBeInTheDocument();
      expect(
        screen.getByRole("checkbox", {
          name: "Select schedule due 2026-08-25",
        }),
      ).toBeChecked();
    });
    expect(onResult).toHaveBeenCalledWith(
      "Deleted 1 of 2 schedules; 1 failed.",
    );
    expect(onAllDeleted).not.toHaveBeenCalled();
  });

  it("closes after the last remaining schedule is deleted", async () => {
    const deleteTask = vi.fn().mockResolvedValue(undefined);
    const onResult = vi.fn();
    const onAllDeleted = vi.fn();
    render(
      <ScheduleManagementDialog
        tasks={[tasks[0]]}
        projects={projects}
        onClose={vi.fn()}
        onDeleteTask={deleteTask}
        onTasksChange={vi.fn()}
        onResult={onResult}
        onAllDeleted={onAllDeleted}
      />,
    );

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Select schedule due 2026-08-20",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Delete selected (1)" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete 1 schedule" }));

    await waitFor(() => expect(onAllDeleted).toHaveBeenCalledOnce());
    expect(onResult).toHaveBeenCalledWith("Deleted 1 schedule.");
  });
});
