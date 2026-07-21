import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { Store } from "@tauri-apps/plugin-store";
import { load } from "@tauri-apps/plugin-store";
import { z } from "zod";
import {
  QuizSchema,
  QuizMetadataSchema,
  type Quiz,
  type QuizMetadata,
} from "../types";
import {
  STORE_FILENAME,
  STORE_KEY_BASE_PATH,
  TAURI_COMMAND_GET_QUIZZES,
} from "../constants";

export function useQuizzes() {
  const [quizzes, setQuizzes] = useState<QuizMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedQuizMeta, setSelectedQuizMeta] = useState<QuizMetadata | null>(
    null,
  );
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [loadingActiveQuiz, setLoadingActiveQuiz] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [basePath, setBasePath] = useState<string | null>(null);
  const [storeInstance, setStoreInstance] = useState<Store | null>(null);

  // Initialize store and base path
  useEffect(() => {
    async function initStore() {
      try {
        const store = await load(STORE_FILENAME, { autoSave: false } as any);
        setStoreInstance(store);

        const localPath = localStorage.getItem(STORE_KEY_BASE_PATH);
        const savedPath = await store.get<string>(STORE_KEY_BASE_PATH);

        if (savedPath) {
          setBasePath(savedPath);
        } else if (localPath) {
          await store.set(STORE_KEY_BASE_PATH, localPath);
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
        const rawData = await invoke(TAURI_COMMAND_GET_QUIZZES);
        const fetchedQuizzes = z.array(QuizMetadataSchema).parse(rawData);
        setQuizzes(fetchedQuizzes);
      } catch (error) {
        console.error("Failed to load quizzes:", error);
      } finally {
        setLoading(false);
      }
    }
    void loadQuizzes();
  }, [basePath]);

  // Fetch active quiz content when selected meta changes
  useEffect(() => {
    async function loadActiveQuiz() {
      if (!selectedQuizMeta) {
        setActiveQuiz(null);
        return;
      }
      setLoadingActiveQuiz(true);
      try {
        const rawData = await invoke("get_quiz_content", {
          path: selectedQuizMeta.path,
          topic: selectedQuizMeta.topic,
        });
        const fetchedQuiz = QuizSchema.parse(rawData);
        setActiveQuiz(fetchedQuiz);
      } catch (error) {
        console.error("Failed to load active quiz:", error);
        setActiveQuiz(null);
      } finally {
        setLoadingActiveQuiz(false);
      }
    }
    void loadActiveQuiz();
  }, [selectedQuizMeta]);

  const selectFolder = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
    });
    if (selected && typeof selected === "string" && selected !== basePath) {
      setBasePath(selected);
      setSelectedQuizMeta(null);
      if (storeInstance) {
        await storeInstance.set(STORE_KEY_BASE_PATH, selected);
        await storeInstance.save();
      }
    }
  };

  const handleSync = async () => {
    if (!basePath) return;
    setIsSyncing(true);
    try {
      const rawData = await invoke(TAURI_COMMAND_GET_QUIZZES);
      const fetchedQuizzes = z.array(QuizMetadataSchema).parse(rawData);

      setQuizzes((prevQuizzes) => {
        const prevQuizMap = new Map(prevQuizzes.map((q) => [q.path, q]));

        const mergedQuizzes = fetchedQuizzes.map((fetched) => {
          const existing = prevQuizMap.get(fetched.path);
          if (existing && existing.last_modified === fetched.last_modified) {
            return existing;
          }
          return fetched;
        });

        if (selectedQuizMeta) {
          const updatedSelected = mergedQuizzes.find(
            (q) => q.path === selectedQuizMeta.path,
          );
          setSelectedQuizMeta(updatedSelected || null);
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
      {} as Record<string, QuizMetadata[]>,
    );
  }, [filteredQuizzes]);

  return {
    quizzes,
    loading,
    isSyncing,
    selectedQuizMeta,
    setSelectedQuizMeta,
    activeQuiz,
    loadingActiveQuiz,
    searchQuery,
    setSearchQuery,
    basePath,
    selectFolder,
    handleSync,
    groupedQuizzes,
  };
}
