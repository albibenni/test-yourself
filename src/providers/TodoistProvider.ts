import { TodoistApi } from "@doist/todoist-sdk";
import { z } from "zod";
import {
  type AddTaskArgs,
  type Project,
  ProjectSchema,
  type Task,
  type TaskProvider,
  TaskSchema,
} from "./TaskProvider";

const ProjectsResponseSchema = z.union([
  z.object({ results: z.array(ProjectSchema) }).transform((val) => val.results),
  z.array(ProjectSchema),
]);

const TasksResponseSchema = z.union([
  z.object({ results: z.array(TaskSchema) }).transform((val) => val.results),
  z.array(TaskSchema),
]);

export class TodoistProvider implements TaskProvider {
  private api: TodoistApi;
  private token: string;

  constructor(token: string) {
    this.token = token;
    this.api = new TodoistApi(token);
  }

  async getProjects(): Promise<Project[]> {
    const response = await this.api.getProjects();
    return ProjectsResponseSchema.parse(response);
  }

  async getTasks(args?: { filter?: string }): Promise<Task[]> {
    const response = await this.api.getTasks(
      args as Parameters<TodoistApi["getTasks"]>[0],
    );
    return TasksResponseSchema.parse(response);
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

    const url = `https://api.todoist.com/api/v1/tasks/filter?query=${encodeURIComponent("search: " + searchParam)}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to search tasks: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    return TasksResponseSchema.parse(data);
  }

  async addTask(task: AddTaskArgs): Promise<Task> {
    const response = await this.api.addTask({
      content: task.content,
      description: task.description,
      projectId: task.projectId,
      dueString: task.dueString,
      priority: task.priority,
    });
    return TaskSchema.parse(response);
  }
}
