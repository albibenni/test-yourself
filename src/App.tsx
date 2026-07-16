import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { load, Store } from "@tauri-apps/plugin-store";
import "./App.css";import { Quiz } from "./types";
import { TopBar } from "./components/TopBar";
import { Sidebar } from "./components/Sidebar";
import { QuestionCard } from "./components/QuestionCard";

function App() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [basePath, setBasePath] = useState<string | null>(null);
  const [storeInstance, setStoreInstance] = useState<Store | null>(null);

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

  useEffect(() => {
    async function loadQuizzes() {
      if (!basePath) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const fetchedQuizzes = await invoke<Quiz[]>("get_quizzes", {
          basePath,
        });
        setQuizzes(fetchedQuizzes);
      } catch (error) {
        console.error("Failed to load quizzes:", error);
      } finally {
        setLoading(false);
      }
    }
    void loadQuizzes();
  }, [basePath]);

  const handleSync = async () => {
    if (!basePath) return;
    setIsSyncing(true);
    try {
      const fetchedQuizzes = await invoke<Quiz[]>("get_quizzes", { basePath });

      setQuizzes((prevQuizzes) => {
        // Create a map of existing quizzes for quick lookup
        const prevQuizMap = new Map(prevQuizzes.map((q) => [q.path, q]));

        const mergedQuizzes = fetchedQuizzes.map((fetched) => {
          const existing = prevQuizMap.get(fetched.path);
          if (existing && existing.last_modified === fetched.last_modified) {
            return existing;
          }
          return fetched;
        });

        // Ensure selectedQuiz gets updated to the latest reference if it was modified
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

  // Filter quizzes by search query
  const filteredQuizzes = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return quizzes.filter(
      (quiz) =>
        quiz.title.toLowerCase().includes(query) ||
        quiz.topic.toLowerCase().includes(query),
    );
  }, [quizzes, searchQuery]);

  // Group filtered quizzes by topic
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

  return (
    <div className="app-wrapper">
      <TopBar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        selectFolder={selectFolder}
      />

      <div className="app-container">
        <Sidebar
          isSidebarOpen={isSidebarOpen}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          loading={loading}
          groupedQuizzes={groupedQuizzes}
          selectedQuiz={selectedQuiz}
          setSelectedQuiz={setSelectedQuiz}
          handleSync={handleSync}
          isSyncing={isSyncing}
        />

        <main className="main-content">
          {!basePath ? (
            <div className="empty-state">
              <div
                className="header-title-row"
                style={{ justifyContent: "center" }}
              >
                <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 600 }}>
                  Select Quiz Folder
                </h2>
              </div>
              <p>Please select a directory containing your Markdown quizzes.</p>
              <button
                onClick={selectFolder}
                style={{
                  marginTop: "1rem",
                  padding: "0.5rem 1rem",
                  fontSize: "1rem",
                  cursor: "pointer",
                }}
              >
                Choose Folder
              </button>
            </div>
          ) : selectedQuiz ? (
            <div className="quiz-viewer">
              <div className="quiz-header">
                <div className="header-title-row">
                  <h1>{selectedQuiz.title}</h1>
                </div>
                <p>Topic: {selectedQuiz.topic || "General"}</p>
              </div>
              <div className="questions-container">
                {selectedQuiz.questions.map((q) => (
                  <QuestionCard
                    key={`${selectedQuiz.path}-${q.id}`}
                    question={q}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <div
                className="header-title-row"
                style={{ justifyContent: "center" }}
              >
                <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 600 }}>
                  Select a Quiz
                </h2>
              </div>
              <p>
                Choose a topic from the sidebar to begin testing your knowledge.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
