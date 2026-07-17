import { useState, useCallback } from "react";
import { TodoistApi, type AddTaskArgs } from "@doist/todoist-sdk";
import { load } from "@tauri-apps/plugin-store";
import { z } from "zod";
import { STORE_FILENAME } from "../constants";

export const ProjectSchema = z
  .object({
    id: z.string(),
    name: z.string(),
  })
  .passthrough();

export type Project = z.infer<typeof ProjectSchema>;

const ProjectsResponseSchema = z.union([
  z.object({ results: z.array(ProjectSchema) }).transform(val => val.results),
  z.array(ProjectSchema)
]);

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

const TasksResponseSchema = z.union([
  z.object({ results: z.array(TaskSchema) }).transform(val => val.results),
  z.array(TaskSchema)
]);

export function useTodoist() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const getApi = async () => {
    const store = await load(STORE_FILENAME, { autoSave: false } as any);
    const token =
      (await store.get<string>("todoist_token")) ||
      localStorage.getItem("todoist_token");
    if (!token) {
      throw new Error(
        "Missing Todoist token. Please configure it in settings.",
      );
    }
    return new TodoistApi(token);
  };

  const getVaultName = async () => {
    const store = await load(STORE_FILENAME, { autoSave: false } as any);
    return (
      (await store.get<string>("obsidian_vault")) ||
      localStorage.getItem("obsidian_vault") ||
      "Vault"
    );
  };

  const getProjects = useCallback(async (): Promise<Project[]> => {
    setLoading(true);
    setError("");
    try {
      const api = await getApi();
      const response = await api.getProjects();
      const parsed = ProjectsResponseSchema.parse(response);
      return parsed;
    } catch (err: unknown) {
      setError("Failed to fetch Todoist projects. Check your token.");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getTasks = useCallback(async (): Promise<Task[]> => {
    setLoading(true);
    setError("");
    try {
      const api = await getApi();
      const response = await api.getTasks();
      const parsed = TasksResponseSchema.parse(response);
      return parsed;
    } catch (err: unknown) {
      setError("Failed to fetch Todoist tasks.");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const addTask = useCallback(
    async (taskDetails: AddTaskArgs): Promise<Task> => {
      setLoading(true);
      setError("");
      try {
        const api = await getApi();
        const response = await api.addTask(taskDetails);
        return TaskSchema.parse(response);
      } catch (err: unknown) {
        setError("Failed to create task.");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const getDefaultSettings = async () => {
    const store = await load(STORE_FILENAME, { autoSave: false } as any);
    return {
      defaultDate: (await store.get<string>("default_todoist_date")) || "tomorrow",
      defaultPriority: (await store.get<number>("default_todoist_priority")) || 4,
      defaultProject: (await store.get<string>("default_todoist_project")) || "",
    };
  };

  return {
    getProjects,
    getTasks,
    addTask,
    getVaultName,
    getDefaultSettings,
    loading,
    error,
    setError,
  };
}
