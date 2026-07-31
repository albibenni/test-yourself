import type { Project, Task } from "../schemas";

export type { Project, Task };

export interface AddTaskArgs {
  content: string;
  description?: string;
  projectId?: string;
  dueString?: string;
  priority?: number;
}

export interface TaskProvider {
  getProjects(): Promise<Project[]>;
  getTasks(args?: { filter?: string }): Promise<Task[]>;
  searchTasks(query: string): Promise<Task[]>;
  addTask(task: AddTaskArgs): Promise<Task>;
}
