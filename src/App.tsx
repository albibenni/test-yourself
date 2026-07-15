import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

import { Quiz } from "./types";
import { TopBar } from "./components/TopBar";
import { Sidebar } from "./components/Sidebar";
import { QuestionCard } from "./components/QuestionCard";

function App() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    async function loadQuizzes() {
      try {
        // We use the absolute path to SecondBrain for now.
        // In a real app, this might be configurable via a settings dialog.
        const basePath =
          "/Users/benni/benni-projects/SecondBrain/Computer Science";
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
  }, []);

  // Filter quizzes by search query
  const filteredQuizzes = quizzes.filter(
    (quiz) =>
      quiz.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      quiz.topic.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Group filtered quizzes by topic
  const groupedQuizzes = filteredQuizzes.reduce(
    (acc, quiz) => {
      if (!acc[quiz.topic]) acc[quiz.topic] = [];
      acc[quiz.topic].push(quiz);
      return acc;
    },
    {} as Record<string, Quiz[]>,
  );

  return (
    <div className="app-wrapper">
      <TopBar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
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
        />

        <main className="main-content">
          {selectedQuiz ? (
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
