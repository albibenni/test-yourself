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
import { getSecureToken } from "../utils/secureStore";

export function useTodoist() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const getProvider = useCallback(async (): Promise<TaskProvider> => {
    const store = await load(STORE_FILENAME, { autoSave: false, defaults: {} });
    const token =
      (await getSecureToken("todoist_token")) ||
      (await store.get<string>("todoist_token")) ||
      window.localStorage.getItem("todoist_token");
    if (!token) {
      throw new Error("Missing API token. Please configure it in settings.");
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
      setError("Failed to fetch projects. Check your token.");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getProvider]);

  const getTasks = useCallback(async (): Promise<Task[]> => {
    setLoading(true);
    setError("");
    try {
      const provider = await getProvider();
      return await provider.getTasks();
    } catch (err: unknown) {
      setError("Failed to fetch tasks.");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getProvider]);

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
    addTask,
    getDefaultSettings,
    loading,
    error,
    setError,
  };
}
