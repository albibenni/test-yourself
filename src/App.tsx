import { useState } from "react";
import { useQuizzes } from "./hooks/useQuizzes";
import "./App.css";
import { TopBar } from "./components/TopBar";
import { Sidebar } from "./components/Sidebar";
import { QuestionCard } from "./components/QuestionCard";
import { SettingsModal } from "./components/SettingsModal";
import { ScheduleModal } from "./components/ScheduleModal";
import { DEFAULT_TOPIC } from "./constants";

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const {
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
  } = useQuizzes();

  return (
    <div className="app-wrapper">
      <TopBar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        selectFolder={() => void selectFolder()}
        onOpenSettings={() => setIsSettingsOpen(true)}
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
          handleSync={() => void handleSync()}
          isSyncing={isSyncing}
        />

        <main className="main-content">
          {!basePath ? (
            <div className="empty-state">
              <div className="header-title-row empty-state-header">
                <h2 className="empty-state-title">Select Quiz Folder</h2>
              </div>
              <p>Please select a directory containing your Markdown quizzes.</p>
              <button
                onClick={() => void selectFolder()}
                className="primary-btn"
              >
                Choose Folder
              </button>
            </div>
          ) : selectedQuiz ? (
            <div className="quiz-viewer">
              <div className="quiz-header">
                <div className="header-title-row">
                  <h1>{selectedQuiz.title}</h1>
                  <button
                    className="button-primary"
                    onClick={() => setIsScheduleOpen(true)}
                    style={{
                      marginLeft: "1rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect
                        x="3"
                        y="4"
                        width="18"
                        height="18"
                        rx="2"
                        ry="2"
                      ></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    Schedule
                  </button>
                </div>
                <p>
                  Topic:{" "}
                  <a
                    href={`obsidian://open?file=${encodeURIComponent(selectedQuiz.path)}`}
                    style={{ color: "inherit", textDecoration: "underline" }}
                  >
                    {selectedQuiz.topic || DEFAULT_TOPIC}
                  </a>
                </p>
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
              <div className="header-title-row empty-state-header">
                <h2 className="empty-state-title">Select a Quiz</h2>
              </div>
              <p>
                Choose a topic from the sidebar to begin testing your knowledge.
              </p>
            </div>
          )}
        </main>
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
      <ScheduleModal
        isOpen={isScheduleOpen}
        onClose={() => setIsScheduleOpen(false)}
        quiz={selectedQuiz}
        onSuccess={() => showToast("Task created successfully!")}
      />
      
      {toastMessage && (
        <div className="toast-notification">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          {toastMessage}
        </div>
      )}
    </div>
  );
}

export default App;
