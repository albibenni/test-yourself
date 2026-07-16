import { useState, useCallback } from "react";
import {
  TodoistApi,
  type Project,
  type Task,
  type AddTaskArgs,
} from "@doist/todoist-sdk";
import { load } from "@tauri-apps/plugin-store";
import { STORE_FILENAME } from "../constants";

export function useTodoist() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const getApi = async () => {
    const store = await load(STORE_FILENAME, { autoSave: false });
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
    const store = await load(STORE_FILENAME, { autoSave: false });
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
      // The SDK types return Project[] directly. We can cast if necessary,
      // but if the SDK types are correct, we can just return it.
      return response as Project[];
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
      return response as Task[];
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
        return await api.addTask(taskDetails);
      } catch (err: unknown) {
        setError("Failed to create task.");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return {
    getProjects,
    getTasks,
    addTask,
    getVaultName,
    loading,
    error,
    setError,
  };
}
