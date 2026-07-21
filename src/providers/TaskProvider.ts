import { z } from "zod";

export const ProjectSchema = z
  .object({
    id: z.string(),
    name: z.string(),
  })
  .passthrough();

export type Project = z.infer<typeof ProjectSchema>;

export const TaskSchema = z
  .object({
    id: z.string(),
    content: z.string(),
    due: z
      .object({
        date: z.string(),
      })
      .nullable()
      .optional(),
  })
  .passthrough();

export type Task = z.infer<typeof TaskSchema>;

export interface AddTaskArgs {
  content: string;
  description?: string;
  projectId?: string;
  dueString?: string;
  priority?: number;
}

export interface TaskProvider {
  getProjects(): Promise<Project[]>;
  getTasks(): Promise<Task[]>;
  addTask(task: AddTaskArgs): Promise<Task>;
}
