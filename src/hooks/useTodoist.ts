import { load } from "@tauri-apps/plugin-store";
import { useCallback, useState } from "react";
import { STORE_FILENAME } from "../constants";
import type {
  AddTaskArgs,
  Project,
  Task,
  TaskProvider,
} from "../providers/TaskProvider";
import { TodoistProvider } from "../providers/TodoistProvider";
import { getAuthorizedTodoistToken } from "../todoistOAuth";

export function useTodoist() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const getProvider = useCallback(async (): Promise<TaskProvider> => {
    const token = await getAuthorizedTodoistToken();
    if (!token) {
      throw new Error("Todoist is not connected. Connect it in settings.");
    }
    return new TodoistProvider(token);
  }, []);

  const getProjects = useCallback(async (): Promise<Project[]> => {
    setLoading(true);
    setError("");
    try {
      const provider = await getProvider();
      return await provider.getProjects();
    } catch (err: unknown) {
      setError("Failed to fetch projects. Check your Todoist connection.");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getProvider]);

  const getTasks = useCallback(
    async (args?: { filter?: string }): Promise<Task[]> => {
      setLoading(true);
      setError("");
      try {
        const provider = await getProvider();
        return await provider.getTasks(args);
      } catch (err: unknown) {
        setError("Failed to fetch tasks.");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [getProvider],
  );

  const searchTasks = useCallback(
    async (query: string): Promise<Task[]> => {
      setLoading(true);
      setError("");
      try {
        const provider = await getProvider();
        return await provider.searchTasks(query);
      } catch (err: unknown) {
        setError("Failed to search tasks.");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [getProvider],
  );

  const addTask = useCallback(
    async (taskDetails: AddTaskArgs): Promise<Task> => {
      setLoading(true);
      setError("");
      try {
        const provider = await getProvider();
        return await provider.addTask(taskDetails);
      } catch (err: unknown) {
        setError("Failed to create task.");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [getProvider],
  );

  const getDefaultSettings = useCallback(async () => {
    const store = await load(STORE_FILENAME, { autoSave: false, defaults: {} });
    return {
      defaultDate:
        (await store.get<string>("default_todoist_date")) || "tomorrow",
      defaultPriority:
        (await store.get<number>("default_todoist_priority")) || 4,
      defaultProject:
        (await store.get<string>("default_todoist_project")) || "",
    };
  }, []);

  return {
    getProjects,
    getTasks,
    searchTasks,
    addTask,
    getDefaultSettings,
    loading,
    error,
    setError,
  };
}
