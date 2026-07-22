import { useState, useCallback } from "react";
import { load } from "@tauri-apps/plugin-store";
import { STORE_FILENAME } from "../constants";
import { TodoistProvider } from "../providers/TodoistProvider";
import type {
  TaskProvider,
  Task,
  Project,
  AddTaskArgs,
} from "../providers/TaskProvider";
import { getSecureToken } from "../utils/secureStore";

export function useTodoist() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const getProvider = async (): Promise<TaskProvider> => {
    const store = await load(STORE_FILENAME, { autoSave: false, defaults: {} });
    const token =
      (await getSecureToken("todoist_token")) ||
      (await store.get<string>("todoist_token")) ||
      window.localStorage.getItem("todoist_token");
    if (!token) {
      throw new Error("Missing API token. Please configure it in settings.");
    }
    return new TodoistProvider(token);
  };

  const getVaultName = async () => {
    const store = await load(STORE_FILENAME, { autoSave: false, defaults: {} });
    return (
      (await store.get<string>("obsidian_vault")) ||
      window.localStorage.getItem("obsidian_vault") ||
      "Vault"
    );
  };

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
  }, []);

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
  }, []);

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
    [],
  );

  const getDefaultSettings = async () => {
    const store = await load(STORE_FILENAME, { autoSave: false, defaults: {} });
    return {
      defaultDate:
        (await store.get<string>("default_todoist_date")) || "tomorrow",
      defaultPriority:
        (await store.get<number>("default_todoist_priority")) || 4,
      defaultProject:
        (await store.get<string>("default_todoist_project")) || "",
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
