import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { load, Store } from "@tauri-apps/plugin-store";
import { Quiz } from "../types";

export function useQuizzes() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [basePath, setBasePath] = useState<string | null>(null);
  const [storeInstance, setStoreInstance] = useState<Store | null>(null);

  // Initialize store and base path
  useEffect(() => {
    async function initStore() {
      try {
        const store = await load("settings.json", { autoSave: false });
        setStoreInstance(store);

        const localPath = localStorage.getItem("quiz_base_path");
        const savedPath = await store.get<string>("quiz_base_path");

        if (savedPath) {
          setBasePath(savedPath);
        } else if (localPath) {
          await store.set("quiz_base_path", localPath);
          await store.save();
          setBasePath(localPath);
        }
      } catch (err) {
        console.error("Failed to load store:", err);
      }
    }
    void initStore();
  }, []);

  // Fetch quizzes whenever basePath is available
  useEffect(() => {
    async function loadQuizzes() {
      if (!basePath) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const fetchedQuizzes = await invoke<Quiz[]>("get_quizzes");
        setQuizzes(fetchedQuizzes);
      } catch (error) {
        console.error("Failed to load quizzes:", error);
      } finally {
        setLoading(false);
      }
    }
    void loadQuizzes();
  }, [basePath]);

  const selectFolder = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
    });
    if (selected && typeof selected === "string") {
      setBasePath(selected);
      if (storeInstance) {
        await storeInstance.set("quiz_base_path", selected);
        await storeInstance.save();
      }
    }
  };

  const handleSync = async () => {
    if (!basePath) return;
    setIsSyncing(true);
    try {
      const fetchedQuizzes = await invoke<Quiz[]>("get_quizzes");

      setQuizzes((prevQuizzes) => {
        const prevQuizMap = new Map(prevQuizzes.map((q) => [q.path, q]));

        const mergedQuizzes = fetchedQuizzes.map((fetched) => {
          const existing = prevQuizMap.get(fetched.path);
          if (existing && existing.last_modified === fetched.last_modified) {
            return existing;
          }
          return fetched;
        });

        if (selectedQuiz) {
          const updatedSelected = mergedQuizzes.find(
            (q) => q.path === selectedQuiz.path,
          );
          setSelectedQuiz(updatedSelected || null);
        }

        return mergedQuizzes;
      });
    } catch (error) {
      console.error("Failed to sync quizzes:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  const filteredQuizzes = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return quizzes.filter(
      (quiz) =>
        quiz.title.toLowerCase().includes(query) ||
        quiz.topic.toLowerCase().includes(query),
    );
  }, [quizzes, searchQuery]);

  const groupedQuizzes = useMemo(() => {
    return filteredQuizzes.reduce(
      (acc, quiz) => {
        if (!acc[quiz.topic]) acc[quiz.topic] = [];
        acc[quiz.topic].push(quiz);
        return acc;
      },
      {} as Record<string, Quiz[]>,
    );
  }, [filteredQuizzes]);

  return {
    quizzes,
    loading,
    isSyncing,
    selectedQuiz,
    setSelectedQuiz,
    searchQuery,
    setSearchQuery,
    basePath,
    selectFolder,
    handleSync,
    groupedQuizzes,
  };
}
