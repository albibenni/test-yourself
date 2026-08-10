import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { confirm, open } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { type as osType } from "@tauri-apps/plugin-os";
import { check } from "@tauri-apps/plugin-updater";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuizzes } from "./hooks/useQuizzes";
import { useTheme } from "./hooks/useTheme";
import "./App.css";
import { lazy, Suspense } from "react";
import { FolderBrowserModal } from "./components/FolderBrowserModal";
import { QuestionCard } from "./components/QuestionCard";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { WorksheetViewer } from "./components/WorksheetViewer";
import { DEFAULT_TOPIC } from "./constants";

const SettingsView = lazy(() =>
  import("./components/SettingsView").then((m) => ({
    default: m.SettingsView,
  })),
);
const ScheduleModal = lazy(() =>
  import("./components/ScheduleModal").then((m) => ({
    default: m.ScheduleModal,
  })),
);

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isFolderBrowserOpen, setIsFolderBrowserOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSettingsDirty, setIsSettingsDirty] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const { theme, accent, textColor, saveTheme, saveAccent, saveTextColor } =
    useTheme();

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  const [updateVersion, setUpdateVersion] = useState<string | null>(null);

  useEffect(() => {
    async function checkForUpdates() {
      try {
        const update = await check();
        if (update) {
          setUpdateVersion(update.version);
          showToast(`Update v${update.version} is available!`);
        }
      } catch {
        // silently ignore update check failures on startup
      }
    }
    void checkForUpdates();
  }, [showToast]);

  const [pendingQuizLink, setPendingQuizLink] = useState<string | null>(null);

  const {
    loading,
    isSyncing,
    selectedQuizMeta,
    setSelectedQuizMeta,
    activeQuiz,
    activeWorksheet,
    loadingActiveQuiz,
    searchQuery,
    setSearchQuery,
    basePath,
    updateBasePath,
    handleSync,
    groupedQuizzes,
    quizzes,
  } = useQuizzes();

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    async function setupDeepLink() {
      try {
        const { onOpenUrl, getCurrent } = await import(
          "@tauri-apps/plugin-deep-link"
        );

        const handleUrls = async (urls: string[] | null) => {
          if (!urls) return;
          for (const url of urls) {
            try {
              const u = new URL(url);
              if (
                u.protocol === "test-yourself:" &&
                u.searchParams.has("quiz")
              ) {
                const quizPath = u.searchParams.get("quiz");
                if (quizPath) {
                  setPendingQuizLink(quizPath);
                  try {
                    const { getCurrentWindow } = await import(
                      "@tauri-apps/api/window"
                    );
                    const appWindow = getCurrentWindow();
                    await appWindow.unminimize();
                    await appWindow.setFocus();
                  } catch (err) {
                    console.warn("Failed to focus window:", err);
                  }
                }
              }
            } catch (e) {
              console.warn("Failed to parse deep link:", e);
            }
          }
        };

        const currentUrls = await getCurrent();
        handleUrls(currentUrls);

        unlisten = await onOpenUrl(handleUrls);
      } catch (e) {
        console.warn("Deep link plugin not found or failed", e);
      }

      try {
        const initialUrl = await invoke<string | null>("get_initial_url");
        if (initialUrl) {
          try {
            const u = new URL(initialUrl);
            if (u.protocol === "test-yourself:" && u.searchParams.has("quiz")) {
              const quizPath = u.searchParams.get("quiz");
              if (quizPath) {
                setPendingQuizLink(quizPath);
              }
            }
          } catch (e) {
            console.warn("Failed to parse custom deep link:", e);
          }
        }
      } catch (e) {
        console.warn("Failed to get initial url:", e);
      }
    }
    void setupDeepLink();

    // Also listen to single-instance argv forwards
    let unlistenEvent: (() => void) | undefined;
    listen<string>("deep-link-received", async (event) => {
      try {
        const u = new URL(event.payload);
        if (u.protocol === "test-yourself:" && u.searchParams.has("quiz")) {
          const quizPath = u.searchParams.get("quiz");
          if (quizPath) {
            setPendingQuizLink(quizPath);
            try {
              const { getCurrentWindow } = await import(
                "@tauri-apps/api/window"
              );
              const appWindow = getCurrentWindow();
              await appWindow.unminimize();
              await appWindow.setFocus();
            } catch (err) {
              console.warn("Failed to focus window:", err);
            }
          }
        }
      } catch (e) {
        console.warn("Failed to parse custom deep link:", e);
      }
    })
      .then((unlistenFn) => {
        unlistenEvent = unlistenFn;
      })
      .catch((e) => console.warn("Failed to listen to deep link:", e));

    return () => {
      if (unlisten) unlisten();
      if (unlistenEvent) unlistenEvent();
    };
  }, []);

  useEffect(() => {
    if (pendingQuizLink && quizzes && quizzes.length > 0) {
      const normalizedPending = pendingQuizLink.replace(/\\/g, "/");
      let targetQuiz = quizzes.find((q) => {
        const normalizedPath = q.path.replace(/\\/g, "/");
        return (
          normalizedPath.endsWith(normalizedPending) ||
          normalizedPath === normalizedPending
        );
      });

      if (
        !targetQuiz &&
        normalizedPending.endsWith(".md") &&
        !normalizedPending.endsWith(".worksheet.md")
      ) {
        const fallbackPending = normalizedPending.replace(
          /\.md$/,
          ".worksheet.md",
        );
        targetQuiz = quizzes.find((q) => {
          const normalizedPath = q.path.replace(/\\/g, "/");
          return (
            normalizedPath.endsWith(fallbackPending) ||
            normalizedPath === fallbackPending
          );
        });
      }
      if (targetQuiz) {
        setTimeout(() => {
          setSelectedQuizMeta({ ...targetQuiz });
          setSearchQuery(""); // Clear search so it appears in sidebar
          setPendingQuizLink(null);
          setIsSettingsOpen(false);
        }, 0);
      } else {
        setTimeout(() => {
          showToast(`Quiz not found for deep link: ${normalizedPending}`);
        }, 0);
        alert(`Deep link quiz not found in library: ${normalizedPending}`);
        console.warn("Quiz not found for deep link:", pendingQuizLink);
      }
    }
  }, [
    pendingQuizLink,
    quizzes,
    setSelectedQuizMeta,
    setSearchQuery,
    showToast,
  ]);

  const [answers, setAnswers] = useState<Record<string, string>>({});

  const [prevResetParams, setPrevResetParams] = useState({
    path: selectedQuizMeta?.path,
    key: resetKey,
  });

  const [visibleCount, setVisibleCount] = useState(10);

  if (
    selectedQuizMeta?.path !== prevResetParams.path ||
    resetKey !== prevResetParams.key
  ) {
    setPrevResetParams({ path: selectedQuizMeta?.path, key: resetKey });
    setAnswers({});
    setVisibleCount(10);
  }

  const totalQuestions = activeQuiz?.questions.length || 0;
  const answeredCount = Object.keys(answers).length;
  const isAllAnswered = totalQuestions > 0 && answeredCount === totalQuestions;
  const correctCount =
    activeQuiz?.questions.filter((q) => answers[q.id] === q.correct_answer)
      .length || 0;

  const observer = useRef<IntersectionObserver>(null);
  const lastQuestionElementRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + 10, totalQuestions));
        }
      });
      if (node) observer.current.observe(node);
    },
    [totalQuestions],
  );

  return (
    <div className="app-wrapper">
      <TopBar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        onOpenSettings={() => setIsSettingsOpen(true)}
        hasUpdate={!!updateVersion}
      />

      <div className="app-container">
        <Sidebar
          isSidebarOpen={isSidebarOpen}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          loading={loading}
          groupedQuizzes={groupedQuizzes}
          selectedQuiz={selectedQuizMeta}
          setSelectedQuiz={(quiz) => {
            void (async () => {
              if (isSettingsOpen) {
                if (isSettingsDirty) {
                  const userConfirmed = await confirm(
                    "You have unsaved settings. Are you sure you want to discard your changes and continue?",
                    { title: "Unsaved Changes", kind: "warning" },
                  );
                  if (!userConfirmed) return;
                }
                setIsSettingsOpen(false);
              }
              setSelectedQuizMeta(quiz);
            })();
          }}
          handleSync={() => void handleSync()}
          isSyncing={isSyncing}
          setIsSidebarOpen={setIsSidebarOpen}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        <main className="main-content">
          {isSettingsOpen && (
            <Suspense
              fallback={
                <div style={{ padding: "2rem" }}>Loading Settings...</div>
              }
            >
              <SettingsView
                onClose={() => setIsSettingsOpen(false)}
                theme={theme}
                accent={accent}
                textColor={textColor}
                onSaveSuccess={() => showToast("Settings saved!")}
                onThemeChange={(val) => {
                  void saveTheme(val);
                }}
                onAccentChange={(val) => {
                  void saveAccent(val);
                }}
                onTextColorChange={(val) => {
                  void saveTextColor(val);
                }}
                updateAvailable={updateVersion}
                onDirtyChange={setIsSettingsDirty}
                basePath={basePath}
                onSelectFolder={async () => {
                  try {
                    const selected = await open({
                      directory: true,
                      multiple: false,
                    });
                    if (selected && typeof selected === "string") {
                      await updateBasePath(selected);
                      return;
                    }
                  } catch {
                    // Fallback to visual modal
                  }
                  setIsFolderBrowserOpen(true);
                }}
                onUpdateBasePath={(newPath) => void updateBasePath(newPath)}
              />
            </Suspense>
          )}
          <div
            style={{
              display: isSettingsOpen ? "none" : "flex",
              flexDirection: "column",
              flex: 1,
            }}
          >
            {!basePath ? (
              <div className="empty-state">
                <div className="header-title-row empty-state-header">
                  <h2 className="empty-state-title">Select Quiz Folder</h2>
                </div>
                <p>
                  Please select a directory containing your Markdown quizzes.
                </p>
                <div
                  style={{
                    display: "flex",
                    gap: "0.75rem",
                    flexWrap: "wrap",
                    justifyContent: "center",
                    marginTop: "1rem",
                  }}
                >
                  <button
                    onClick={async () => {
                      try {
                        const selected = await open({
                          directory: true,
                          multiple: false,
                        });
                        if (selected && typeof selected === "string") {
                          await updateBasePath(selected);
                          return;
                        }
                      } catch {
                        // Fallback to visual modal
                      }
                      setIsFolderBrowserOpen(true);
                    }}
                    className="primary-btn"
                  >
                    Choose Folder
                  </button>
                </div>
              </div>
            ) : selectedQuizMeta ? (
              <div className="quiz-viewer">
                <div className="quiz-header">
                  <div className="header-title-row">
                    <h1>
                      {selectedQuizMeta.title.includes("_") &&
                      !selectedQuizMeta.title.includes(" ")
                        ? selectedQuizMeta.title.replace(/_/g, " ")
                        : selectedQuizMeta.title}
                    </h1>
                    <div className="quiz-header-actions">
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
                  </div>
                  <div className="quiz-meta-info">
                    <p className="quiz-topic-line">
                      Topic:{" "}
                      <a
                        href="#"
                        aria-label={`Open topic ${selectedQuizMeta.topic || DEFAULT_TOPIC}`}
                        onClick={(e) => {
                          e.preventDefault();
                          const platform = osType();
                          if (platform === "windows") {
                            void openUrl(
                              `obsidian://open?path=${encodeURIComponent(selectedQuizMeta.path.replace(/\\/g, "/"))}`,
                            );
                          } else {
                            void openUrl(
                              `obsidian://open?path=${encodeURIComponent(selectedQuizMeta.path)}`,
                            );
                          }
                        }}
                        style={{
                          color: "inherit",
                          textDecoration: "underline",
                          cursor: "pointer",
                        }}
                      >
                        {selectedQuizMeta.topic || DEFAULT_TOPIC}
                      </a>
                    </p>
                    <p className="quiz-progress-line">
                      {selectedQuizMeta.is_worksheet
                        ? "Worksheet"
                        : `${answeredCount} of ${totalQuestions} answered`}
                    </p>
                  </div>
                </div>

                {loadingActiveQuiz ? (
                  <div
                    style={{
                      padding: "2rem",
                      textAlign: "center",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Loading content...
                  </div>
                ) : activeWorksheet ? (
                  <WorksheetViewer
                    key={`${activeWorksheet.path}-${resetKey}`}
                    worksheet={activeWorksheet}
                  />
                ) : activeQuiz ? (
                  <>
                    <div className="questions-container">
                      {activeQuiz.questions
                        .slice(0, visibleCount)
                        .map((q, index) => {
                          if (index === visibleCount - 1) {
                            return (
                              <div
                                ref={lastQuestionElementRef}
                                key={`${activeQuiz.path}-${q.id}-${resetKey}-wrapper`}
                              >
                                <QuestionCard
                                  key={`${activeQuiz.path}-${q.id}-${resetKey}`}
                                  question={q}
                                  onAnswer={(_isCorrect, letter) =>
                                    setAnswers((prev) => ({
                                      ...prev,
                                      [q.id]: letter,
                                    }))
                                  }
                                />
                              </div>
                            );
                          }
                          return (
                            <QuestionCard
                              key={`${activeQuiz.path}-${q.id}-${resetKey}`}
                              question={q}
                              onAnswer={(_isCorrect, letter) =>
                                setAnswers((prev) => ({
                                  ...prev,
                                  [q.id]: letter,
                                }))
                              }
                            />
                          );
                        })}
                    </div>

                    {isAllAnswered && (
                      <div
                        className="quiz-summary"
                        style={{
                          marginTop: "3rem",
                          padding: "1.5rem",
                          backgroundColor: "var(--bg-secondary)",
                          borderRadius: "8px",
                        }}
                      >
                        <h2 style={{ marginTop: 0, marginBottom: "0.5rem" }}>
                          Quiz Review
                        </h2>
                        <p
                          style={{
                            fontSize: "1.1rem",
                            fontWeight: 500,
                            marginBottom: "1.5rem",
                          }}
                        >
                          You scored {correctCount} out of {totalQuestions} (
                          {Math.round((correctCount / totalQuestions) * 100)}%)
                        </p>

                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "1rem",
                          }}
                        >
                          {activeQuiz.questions.map((q) => {
                            const selected = answers[q.id];
                            const isCorrect = selected === q.correct_answer;
                            return (
                              <div
                                key={`review-${q.id}`}
                                style={{
                                  padding: "1rem",
                                  borderLeft: `4px solid ${isCorrect ? "var(--success-color)" : "var(--error-color)"}`,
                                  backgroundColor: "var(--bg-primary)",
                                  borderRadius: "4px",
                                }}
                              >
                                <strong
                                  style={{
                                    display: "block",
                                    marginBottom: "0.5rem",
                                  }}
                                >
                                  {q.id}. {q.text}
                                </strong>
                                <div style={{ marginBottom: "0.5rem" }}>
                                  Your answer: <strong>{selected}</strong>{" "}
                                  {isCorrect ? "✨" : "❌"}{" "}
                                  {!isCorrect && (
                                    <span style={{ marginLeft: "0.5rem" }}>
                                      (Correct:{" "}
                                      <strong>{q.correct_answer}</strong>)
                                    </span>
                                  )}
                                </div>
                                {q.explanation && (
                                  <div
                                    style={{
                                      fontSize: "0.9rem",
                                      color: "var(--text-secondary)",
                                      fontStyle: "italic",
                                      marginTop: "0.5rem",
                                    }}
                                  >
                                    Explanation: {q.explanation}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div
                    style={{
                      padding: "2rem",
                      textAlign: "center",
                      color: "var(--error-color)",
                    }}
                  >
                    Failed to load quiz content.
                  </div>
                )}
              </div>
            ) : (
              <div className="empty-state">
                <div className="header-title-row empty-state-header">
                  <h2 className="empty-state-title">Select a Quiz</h2>
                </div>
                <p>
                  Choose a topic from the sidebar to begin testing your
                  knowledge.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>

      {isScheduleOpen && (
        <Suspense fallback={null}>
          <ScheduleModal
            isOpen={isScheduleOpen}
            onClose={() => setIsScheduleOpen(false)}
            quizTitle={selectedQuizMeta?.title || ""}
            quizPath={selectedQuizMeta?.path || ""}
            topic={selectedQuizMeta?.topic || DEFAULT_TOPIC}
            onCheckResult={(msg) => showToast(msg)}
          />
        </Suspense>
      )}

      <FolderBrowserModal
        isOpen={isFolderBrowserOpen}
        onClose={() => setIsFolderBrowserOpen(false)}
        onSelectFolder={(newPath) => {
          void updateBasePath(newPath);
          showToast("Quiz directory updated!");
        }}
        initialPath={basePath}
      />

      {toastMessage && (
        <div role="status" aria-live="polite" className="toast-notification">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
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
