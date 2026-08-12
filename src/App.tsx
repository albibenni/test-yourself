import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { confirm, open } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { type as osType } from "@tauri-apps/plugin-os";
import { check } from "@tauri-apps/plugin-updater";
import { useCallback, useEffect, useState } from "react";
import { useQuizSession } from "./hooks/useQuizSession";
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
  const [folderBrowserPurpose, setFolderBrowserPurpose] = useState<
    "quiz" | "vault"
  >("quiz");
  const [selectedVaultFolder, setSelectedVaultFolder] = useState<string | null>(
    null,
  );
  const isIOS = osType() === "ios";
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

  const selectIosFolder = useCallback(
    async (purpose: "quiz" | "vault") => {
      try {
        const selected = await invoke<string | null>("pick_ios_folder");
        if (!selected) return;

        await updateBasePath(selected);
        if (purpose === "vault") {
          const folderName = selected.split("/").filter(Boolean).pop();
          setSelectedVaultFolder(folderName ?? "Obsidian");
        }
        showToast("Obsidian folder selected.");
      } catch (error) {
        showToast(
          `Unable to open the iOS folder picker: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
    [showToast, updateBasePath],
  );

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const parseDeepLinkUrl = (rawPayload: unknown): string | null => {
      console.log(
        "[DeepLink] parseDeepLinkUrl called with:",
        JSON.stringify(rawPayload),
      );
      let urlStr = "";
      if (Array.isArray(rawPayload) && rawPayload.length > 0) {
        urlStr = String(rawPayload[0]);
      } else if (typeof rawPayload === "string") {
        urlStr = rawPayload;
      } else {
        urlStr = String(rawPayload || "");
      }

      urlStr = urlStr
        .trim()
        .replace(/^\[|\]$/g, "")
        .replace(/^"|"$/g, "");
      console.log("[DeepLink] cleaned urlStr:", urlStr);
      try {
        const u = new URL(urlStr);
        if (u.searchParams.has("quiz")) {
          const q = u.searchParams.get("quiz");
          const decoded = q ? decodeURIComponent(q) : null;
          console.log("[DeepLink] parsed via URL API, quiz:", decoded);
          return decoded;
        }
      } catch (e) {
        console.log("[DeepLink] URL parse failed:", e, "- trying regex");
      }

      const match = urlStr.match(/quiz=([^&]+)/);
      if (match && match[1]) {
        try {
          const decoded = decodeURIComponent(match[1]);
          console.log("[DeepLink] parsed via regex, quiz:", decoded);
          return decoded;
        } catch {
          return match[1];
        }
      }
      console.log("[DeepLink] no quiz param found in URL");
      return null;
    };

    async function setupDeepLink() {
      try {
        const { onOpenUrl } = await import("@tauri-apps/plugin-deep-link");
        console.log("[DeepLink] registering onOpenUrl listener");
        unlisten = await onOpenUrl((urls) => {
          console.log("[DeepLink] onOpenUrl fired:", JSON.stringify(urls));
          const quizPath = parseDeepLinkUrl(urls);
          console.log("[DeepLink] onOpenUrl -> quizPath:", quizPath);
          if (quizPath) {
            setPendingQuizLink(quizPath);
          }
        });
        console.log("[DeepLink] onOpenUrl listener registered");

        const initialUrl = await invoke<string | null>("get_initial_url");
        console.log("[DeepLink] get_initial_url returned:", initialUrl);
        if (initialUrl) {
          const quizPath = parseDeepLinkUrl(initialUrl);
          if (quizPath) {
            setPendingQuizLink(quizPath);
          }
        }
      } catch (e) {
        console.warn("[DeepLink] Failed to setup deep link:", e);
      }
    }
    void setupDeepLink();

    // Also listen to single-instance argv forwards
    let unlistenEvent: (() => void) | undefined;
    listen<unknown>("deep-link-received", async (event) => {
      console.log(
        "[DeepLink] deep-link-received event:",
        JSON.stringify(event.payload),
      );
      const quizPath = parseDeepLinkUrl(event.payload);
      console.log("[DeepLink] deep-link-received -> quizPath:", quizPath);
      if (quizPath) {
        setPendingQuizLink(quizPath);
        if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
          try {
            const { getCurrentWindow } = await import("@tauri-apps/api/window");
            const appWindow = getCurrentWindow();
            await appWindow.unminimize();
            await appWindow.setFocus();
          } catch (err) {
            console.warn("Failed to focus window:", err);
          }
        }
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
      let decodedPending = pendingQuizLink;
      try {
        decodedPending = decodeURIComponent(pendingQuizLink);
      } catch {
        // use raw
      }
      const normalizedPending = decodedPending
        .replace(/\\/g, "/")
        .toLowerCase();
      const pendingFilename = normalizedPending.split("/").pop() || "";
      const pendingStem = pendingFilename.replace(/(\.worksheet)?\.md$/i, "");
      console.log("[DeepLink] resolving:", normalizedPending);
      console.log("[DeepLink] quizzes count:", quizzes.length);
      console.log(
        "[DeepLink] sample paths:",
        quizzes.slice(0, 3).map((q) => q.path),
      );

      let targetQuiz = quizzes.find((q) => {
        const normalizedPath = q.path.replace(/\\/g, "/").toLowerCase();
        const quizFilename = normalizedPath.split("/").pop() || "";
        const quizStem = quizFilename.replace(/(\.worksheet)?\.md$/i, "");

        // 1. Full or suffix path match
        if (
          normalizedPath === normalizedPending ||
          normalizedPath.endsWith(normalizedPending)
        ) {
          return true;
        }
        // 2. Exact filename match (e.g. spiffe_spire_and_mtls_quiz.md)
        if (quizFilename && quizFilename === pendingFilename) {
          return true;
        }
        // 3. File stem match (e.g. spiffe_spire_and_mtls)
        if (quizStem && quizStem === pendingStem) {
          return true;
        }
        // 4. H1 Title match (e.g. "SPIFFE-SPIRE and mTLS")
        const titleLower = q.title.toLowerCase();
        if (titleLower === normalizedPending || titleLower === pendingStem) {
          return true;
        }
        if (
          titleLower.replace(/_/g, " ").replace(/-/g, " ") ===
          pendingStem.replace(/_/g, " ").replace(/-/g, " ")
        ) {
          return true;
        }
        return false;
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
          const normalizedPath = q.path.replace(/\\/g, "/").toLowerCase();
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

  const {
    answers,
    setAnswers,
    visibleCount,
    totalQuestions,
    answeredCount,
    correctCount,
    isAllAnswered,
    lastQuestionElementRef,
  } = useQuizSession(
    selectedQuizMeta ? `${selectedQuizMeta.path}:${resetKey}` : undefined,
    activeQuiz?.questions,
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
                onSaveError={(message) => showToast(message)}
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
                  if (isIOS) {
                    await selectIosFolder("quiz");
                    return;
                  }
                  setFolderBrowserPurpose("quiz");
                  try {
                    const selected = await open({
                      directory: true,
                      multiple: false,
                      recursive: true,
                      fileAccessMode: "scoped",
                    });
                    if (selected && typeof selected === "string") {
                      await updateBasePath(selected);
                      return;
                    }
                    // Canceling the native desktop picker is a no-op.
                    if (!isIOS) return;
                  } catch {
                    if (isIOS) {
                      showToast(
                        "Unable to open the iOS Files picker. Please try again.",
                      );
                      return;
                    }
                    // Desktop fallback
                  }
                  setIsFolderBrowserOpen(true);
                }}
                onSelectVaultFolder={async () => {
                  if (isIOS) {
                    await selectIosFolder("vault");
                    return;
                  }
                  try {
                    const selected = await open({
                      directory: true,
                      multiple: false,
                      recursive: true,
                      fileAccessMode: "scoped",
                    });
                    if (selected && typeof selected === "string") {
                      setSelectedVaultFolder(selected);
                      showToast("Obsidian vault folder selected.");
                      return;
                    }
                  } catch {
                    showToast(
                      "Unable to open the iOS Files picker. Please try again.",
                    );
                  }
                }}
                selectedVaultFolder={selectedVaultFolder}
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
                      if (isIOS) {
                        await selectIosFolder("quiz");
                        return;
                      }
                      try {
                        const selected = await open({
                          directory: true,
                          multiple: false,
                          recursive: true,
                          fileAccessMode: "scoped",
                        });
                        if (selected && typeof selected === "string") {
                          await updateBasePath(selected);
                          return;
                        }
                        // Canceling the native desktop picker is a no-op.
                        if (!isIOS) return;
                      } catch {
                        if (isIOS) {
                          showToast(
                            "Unable to open the iOS Files picker. Please try again.",
                          );
                          return;
                        }
                        // Desktop fallback
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
            quiz={selectedQuizMeta}
            onSuccess={(dateText) =>
              showToast(`Task scheduled for ${dateText}!`)
            }
            onCheckResult={(msg) => showToast(msg)}
          />
        </Suspense>
      )}

      <FolderBrowserModal
        isOpen={isFolderBrowserOpen && !isIOS}
        onClose={() => setIsFolderBrowserOpen(false)}
        onSelectFolder={(newPath) => {
          if (folderBrowserPurpose === "vault") {
            setSelectedVaultFolder(newPath);
            showToast("Obsidian vault folder selected.");
          } else {
            void updateBasePath(newPath);
            showToast("Quiz directory updated!");
          }
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
