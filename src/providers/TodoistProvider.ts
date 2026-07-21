import { TodoistApi } from "@doist/todoist-sdk";
import { z } from "zod";
import {
  type TaskProvider,
  type Project,
  type Task,
  type AddTaskArgs,
  ProjectSchema,
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

  constructor(token: string) {
    this.api = new TodoistApi(token);
  }

  async getProjects(): Promise<Project[]> {
    const response = await this.api.getProjects();
    return ProjectsResponseSchema.parse(response);
  }

  async getTasks(): Promise<Task[]> {
    const response = await this.api.getTasks();
    return TasksResponseSchema.parse(response);
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
