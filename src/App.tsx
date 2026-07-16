import { useState } from "react";
import { useQuizzes } from "./hooks/useQuizzes";
import "./App.css";
import { TopBar } from "./components/TopBar";
import { Sidebar } from "./components/Sidebar";
import { QuestionCard } from "./components/QuestionCard";
import { DEFAULT_TOPIC } from "./constants";

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

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
                </div>
                <p>Topic: {selectedQuiz.topic || DEFAULT_TOPIC}</p>
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
    </div>
  );
}

export default App;
