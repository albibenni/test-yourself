import { useState, useEffect } from "react";
import { useQuizzes } from "./hooks/useQuizzes";
import { useTheme } from "./hooks/useTheme";
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
  const [resetKey, setResetKey] = useState(0);
  const { theme, accent, textColor, saveTheme, saveAccent, saveTextColor } = useTheme();

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

  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    setAnswers({});
  }, [selectedQuiz?.path, resetKey]);

  const totalQuestions = selectedQuiz?.questions.length || 0;
  const answeredCount = Object.keys(answers).length;
  const isAllAnswered = totalQuestions > 0 && answeredCount === totalQuestions;
  const correctCount = selectedQuiz?.questions.filter((q) => answers[q.id] === q.correct_answer).length || 0;

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
                  <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem" }}>
                    <button
                      className="button-secondary"
                      onClick={() => setResetKey((k) => k + 1)}
                      title="Reset Quiz"
                      style={{
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
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                      </svg>
                      Reset
                    </button>
                    <button
                      className="button-primary"
                      onClick={() => setIsScheduleOpen(true)}
                      style={{
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
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                      Schedule
                    </button>
                  </div>
                </div>
                <p>
                  Topic:{" "}
                  <a
                    href={`obsidian://open?file=${encodeURIComponent(selectedQuiz.path)}`}
                    style={{ color: "inherit", textDecoration: "underline" }}
                  >
                    {selectedQuiz.topic || DEFAULT_TOPIC}
                  </a>
                  <span style={{ margin: "0 0.5rem", color: "var(--text-secondary)" }}>•</span>
                  <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                    {answeredCount} of {totalQuestions} answered
                  </span>
                </p>
              </div>
              <div className="questions-container">
                {selectedQuiz.questions.map((q) => (
                  <QuestionCard
                    key={`${selectedQuiz.path}-${q.id}-${resetKey}`}
                    question={q}
                    onAnswer={(_isCorrect, letter) => setAnswers((prev) => ({ ...prev, [q.id]: letter }))}
                  />
                ))}
              </div>

              {isAllAnswered && (
                <div className="quiz-summary" style={{ marginTop: '3rem', padding: '1.5rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px' }}>
                  <h2 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Quiz Review</h2>
                  <p style={{ fontSize: '1.1rem', fontWeight: 500, marginBottom: '1.5rem' }}>
                    You scored {correctCount} out of {totalQuestions} ({Math.round((correctCount / totalQuestions) * 100)}%)
                  </p>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {selectedQuiz.questions.map((q) => {
                      const selected = answers[q.id];
                      const isCorrect = selected === q.correct_answer;
                      return (
                        <div key={`review-${q.id}`} style={{ padding: '1rem', borderLeft: `4px solid ${isCorrect ? 'var(--success-color)' : 'var(--error-color)'}`, backgroundColor: 'var(--bg-primary)', borderRadius: '4px' }}>
                          <strong style={{ display: 'block', marginBottom: '0.5rem' }}>{q.id}. {q.text}</strong>
                          <div style={{ marginBottom: '0.5rem' }}>
                            Your answer: <strong>{selected}</strong> {isCorrect ? '✨' : '❌'} {!isCorrect && <span style={{ marginLeft: '0.5rem' }}>(Correct: <strong>{q.correct_answer}</strong>)</span>}
                          </div>
                          {q.explanation && (
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '0.5rem' }}>
                              Explanation: {q.explanation}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
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
        theme={theme}
        accent={accent}
        textColor={textColor}
        onThemeChange={saveTheme}
        onAccentChange={saveAccent}
        onTextColorChange={saveTextColor}
      />
      <ScheduleModal
        isOpen={isScheduleOpen}
        onClose={() => setIsScheduleOpen(false)}
        quiz={selectedQuiz}
        onSuccess={(dateText) => showToast(`Task created successfully for ${dateText}!`)}
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
