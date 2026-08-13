import {
  GetTasksArgsSchema,
  ProjectsResponseSchema,
  TaskSchema,
  TasksResponseSchema,
} from "../schemas";
import type { AddTaskArgs, Project, Task, TaskProvider } from "./TaskProvider";

export class TodoistProvider implements TaskProvider {
  private readonly token: string;

  constructor(token: string) {
    this.token = token;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`https://api.todoist.com/api/v1${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        ...(init?.headers ?? {}),
      },
    });
    if (!response.ok) {
      throw new Error(
        `Todoist API error: ${response.status} ${response.statusText}`,
      );
    }
    return (await response.json()) as T;
  }

  private async getAll<T>(path: string, params = new URLSearchParams()) {
    const results: T[] = [];
    let cursor: string | null = null;
    do {
      const search = new URLSearchParams(params);
      search.set("limit", "200");
      if (cursor) search.set("cursor", cursor);
      const page = await this.request<{
        results: T[];
        next_cursor: string | null;
      }>(`${path}?${search}`);
      results.push(...page.results);
      cursor = page.next_cursor;
    } while (cursor);
    return results;
  }

  async getProjects(): Promise<Project[]> {
    return ProjectsResponseSchema.parse(await this.getAll("/projects"));
  }

  async getTasks(args?: { filter?: string }): Promise<Task[]> {
    const validArgs = GetTasksArgsSchema.parse(args);
    if (validArgs?.filter) {
      return TasksResponseSchema.parse(
        await this.getAll(
          "/tasks/filter",
          new URLSearchParams({ query: validArgs.filter }),
        ),
      );
    }
    const params = new URLSearchParams();
    if (validArgs?.projectId) params.set("project_id", validArgs.projectId);
    if (validArgs?.sectionId) params.set("section_id", validArgs.sectionId);
    if (validArgs?.label) params.set("label", validArgs.label);
    return TasksResponseSchema.parse(await this.getAll("/tasks", params));
  }

  async searchTasks(query: string): Promise<Task[]> {
    // Keep only alphanumeric characters and use up to first 3 words to avoid API parsing errors
    const safeQuery = query
      .replace(/[^\w\s]/g, " ")
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .slice(0, 3)
      .join(" ");
    const searchParam = safeQuery.length > 0 ? safeQuery : "Review Quiz";

    return TasksResponseSchema.parse(
      await this.getAll(
        "/tasks/filter",
        new URLSearchParams({ query: `search: ${searchParam}` }),
      ),
    );
  }

  async addTask(task: AddTaskArgs): Promise<Task> {
    const response = await this.request("/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: task.content,
        description: task.description,
        project_id: task.projectId,
        due_string: task.dueString,
        priority: task.priority,
      }),
    });
    return TaskSchema.parse(response);
  }
}
