import { useEffect, useRef, useState } from "react";
import type { Project, Task } from "../providers/TaskProvider";

interface ScheduleManagementDialogProps {
  tasks: Task[];
  projects: Project[];
  onClose: () => void;
  onDeleteTask: (taskId: string) => Promise<void>;
  onTasksChange: (tasks: Task[]) => void;
  onResult: (message: string) => void;
  onAllDeleted?: () => void;
}

export function ScheduleManagementDialog({
  tasks,
  projects,
  onClose,
  onDeleteTask,
  onTasksChange,
  onResult,
  onAllDeleted,
}: ScheduleManagementDialogProps) {
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(
    () => new Set(),
  );
  const allSelected = tasks.length > 0 && selectedTaskIds.size === tasks.length;
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || isDeleting) return;
      if (isConfirming) setIsConfirming(false);
      else onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isConfirming, isDeleting, onClose]);

  const toggleTask = (taskId: string) => {
    setSelectedTaskIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const selectedTasks = tasks.filter((task) => selectedTaskIds.has(task.id));

  const handleDelete = async () => {
    if (isDeleting || selectedTasks.length === 0) return;
    setIsDeleting(true);
    const results = await Promise.allSettled(
      selectedTasks.map((task) => onDeleteTask(task.id)),
    );
    const failedIds = new Set(
      selectedTasks
        .filter((_, index) => results[index].status === "rejected")
        .map((task) => task.id),
    );
    const deletedCount = selectedTasks.length - failedIds.size;
    const remainingTasks = tasks.filter(
      (task) => !selectedTaskIds.has(task.id) || failedIds.has(task.id),
    );

    onTasksChange(remainingTasks);
    setSelectedTaskIds(failedIds);
    setIsDeleting(false);
    setIsConfirming(false);

    if (failedIds.size > 0) {
      onResult(
        `Deleted ${deletedCount} of ${selectedTasks.length} schedules; ${failedIds.size} failed.`,
      );
    } else {
      onResult(
        `Deleted ${deletedCount} ${deletedCount === 1 ? "schedule" : "schedules"}.`,
      );
      if (remainingTasks.length === 0) onAllDeleted?.();
    }
  };

  if (isConfirming) {
    const count = selectedTasks.length;
    return (
      <div className="modal-overlay">
        <div
          ref={dialogRef}
          className="modal-content schedule-management-dialog"
          role="dialog"
          aria-modal="true"
          aria-label="Manage schedules"
          tabIndex={-1}
        >
          <h2>{count === 1 ? "Delete schedule?" : "Delete schedules?"}</h2>
          <p>
            This will permanently delete {count} Todoist{" "}
            {count === 1 ? "schedule" : "schedules"}, including any subtasks.
          </p>
          <ul className="schedule-confirm-list">
            {selectedTasks.map((task) => (
              <li key={task.id}>{task.due?.date ?? "No date"}</li>
            ))}
          </ul>
          <div className="schedule-management-actions">
            <button
              className="button-secondary"
              onClick={() => setIsConfirming(false)}
              disabled={isDeleting}
            >
              Cancel
            </button>
            <button
              className="button-danger"
              onClick={() => void handleDelete()}
              disabled={isDeleting}
            >
              {isDeleting
                ? "Deleting..."
                : `Delete ${count} ${count === 1 ? "schedule" : "schedules"}`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div
        ref={dialogRef}
        className="modal-content schedule-management-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Manage schedules"
        tabIndex={-1}
      >
        <div className="schedule-management-header">
          <div>
            <h2>Manage schedules</h2>
            <p>Select the Todoist schedules you want to delete.</p>
          </div>
          <button
            className="schedule-management-close"
            onClick={onClose}
            aria-label="Close schedule manager"
          >
            ×
          </button>
        </div>

        <label className="schedule-select-all">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() =>
              setSelectedTaskIds(
                allSelected ? new Set() : new Set(tasks.map((task) => task.id)),
              )
            }
          />
          Select all
        </label>

        <div className="schedule-task-list">
          {tasks.map((task) => {
            const dueDate = task.due?.date ?? "No date";
            const projectName =
              projects.find((project) => project.id === task.project_id)
                ?.name ?? "Unknown project";
            return (
              <label className="schedule-task-row" key={task.id}>
                <input
                  type="checkbox"
                  checked={selectedTaskIds.has(task.id)}
                  onChange={() => toggleTask(task.id)}
                  aria-label={`Select schedule due ${dueDate}`}
                />
                <span>
                  <strong>{dueDate}</strong>
                  <small>{projectName}</small>
                </span>
              </label>
            );
          })}
        </div>

        <div className="schedule-management-actions">
          <button className="button-secondary" onClick={onClose}>
            Close
          </button>
          <button
            className="button-danger"
            disabled={selectedTaskIds.size === 0}
            onClick={() => setIsConfirming(true)}
          >
            Delete selected ({selectedTaskIds.size})
          </button>
        </div>
      </div>
    </div>
  );
}
