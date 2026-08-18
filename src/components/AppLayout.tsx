import { confirm } from "@tauri-apps/plugin-dialog";
import {
  type Dispatch,
  lazy,
  type SetStateAction,
  Suspense,
  useEffect,
  useRef,
  useState,
} from "react";
import { useMiddleClickScroll } from "../hooks/useMiddleClickScroll";
import type {
  AccentColor,
  Quiz,
  QuizMetadata,
  TextColor,
  ThemeType,
  Worksheet,
} from "../types";
import { FolderBrowserModal } from "./FolderBrowserModal";
import { KeyboardShortcutsDialog } from "./KeyboardShortcutsDialog";
import { QuizViewer } from "./QuizViewer";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

const SettingsView = lazy(() =>
  import("./SettingsView").then((m) => ({ default: m.SettingsView })),
);
const ScheduleModal = lazy(() =>
  import("./ScheduleModal").then((m) => ({ default: m.ScheduleModal })),
);

interface AppLayoutProps {
  sidebarOpen: boolean;
  setSidebarOpen: Dispatch<SetStateAction<boolean>>;
  settingsOpen: boolean;
  setSettingsOpen: Dispatch<SetStateAction<boolean>>;
  settingsDirty: boolean;
  setSettingsDirty: Dispatch<SetStateAction<boolean>>;
  scheduleOpen: boolean;
  setScheduleOpen: Dispatch<SetStateAction<boolean>>;
  folderBrowserOpen: boolean;
  setFolderBrowserOpen: Dispatch<SetStateAction<boolean>>;
  folderPurpose: "quiz" | "vault";
  setFolderPurpose: Dispatch<SetStateAction<"quiz" | "vault">>;
  selectedVaultFolder: string | null;
  setSelectedVaultFolder: Dispatch<SetStateAction<string | null>>;
  isIOS: boolean;
  toastMessage: string | null;
  showToast: (message: string) => void;
  updateVersion: string | null;
  theme: ThemeType;
  accent: AccentColor;
  textColor: TextColor;
  saveTheme: (value: ThemeType) => Promise<void>;
  saveAccent: (value: AccentColor) => Promise<void>;
  saveTextColor: (value: TextColor) => Promise<void>;
  selectIosFolder: (purpose: "quiz" | "vault") => Promise<void>;
  basePath: string | null;
  updateBasePath: (path: string) => Promise<void>;
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  loading: boolean;
  groupedQuizzes: Record<string, QuizMetadata[]>;
  quizzes: QuizMetadata[];
  selectedQuiz: QuizMetadata | null;
  setSelectedQuiz: (quiz: QuizMetadata) => void;
  handleSync: () => void;
  isSyncing: boolean;
  activeQuiz: Quiz | null;
  activeWorksheet: Worksheet | null;
  loadingActiveQuiz: boolean;
  resetKey: number;
  setResetKey: Dispatch<SetStateAction<number>>;
  session: Omit<
    React.ComponentProps<typeof QuizViewer>,
    | "selectedQuiz"
    | "activeQuiz"
    | "activeWorksheet"
    | "loadingActiveQuiz"
    | "resetKey"
    | "onReset"
    | "onSchedule"
  >;
}

export function AppLayout(props: AppLayoutProps) {
  const mainContentRef = useRef<HTMLElement>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const {
    announcement: autoScrollAnnouncement,
    indicator: autoScrollIndicator,
    onAuxClick: handleMainContentAuxClick,
    onMouseDown: handleMainContentMouseDown,
    onWheel: handleMainContentWheel,
  } = useMiddleClickScroll(mainContentRef);
  const {
    sidebarOpen,
    setSidebarOpen,
    settingsOpen,
    setSettingsOpen,
    settingsDirty,
    setSettingsDirty,
    scheduleOpen,
    setScheduleOpen,
    folderBrowserOpen,
    setFolderBrowserOpen,
    folderPurpose,
    setFolderPurpose,
    selectedVaultFolder,
    setSelectedVaultFolder,
    isIOS,
    toastMessage,
    showToast,
    updateVersion,
    theme,
    accent,
    textColor,
    saveTheme,
    saveAccent,
    saveTextColor,
    selectIosFolder,
    basePath,
    updateBasePath,
    searchQuery,
    setSearchQuery,
    loading,
    groupedQuizzes,
    selectedQuiz,
    setSelectedQuiz,
    handleSync,
    isSyncing,
    activeQuiz,
    activeWorksheet,
    loadingActiveQuiz,
    resetKey,
    setResetKey,
    session,
  } = props;

  const chooseQuiz = async (quiz: QuizMetadata) => {
    if (settingsOpen) {
      if (
        settingsDirty &&
        !(await confirm(
          "You have unsaved settings. Are you sure you want to discard your changes and continue?",
          { title: "Unsaved Changes", kind: "warning" },
        ))
      )
        return;
      setSettingsOpen(false);
    }
    setSelectedQuiz(quiz);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.matches("input, textarea, select, [contenteditable='true']") ||
          event.ctrlKey ||
          event.metaKey ||
          event.altKey)
      )
        return;
      if (event.key === "?") {
        event.preventDefault();
        setShortcutsOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to quiz content
      </a>
      <div className="app-wrapper">
        <TopBar
          isSidebarOpen={sidebarOpen}
          setIsSidebarOpen={setSidebarOpen}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenShortcuts={() => setShortcutsOpen(true)}
          hasUpdate={!!updateVersion}
        />
        <div className="app-container">
          <Sidebar
            isSidebarOpen={sidebarOpen}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            loading={loading}
            groupedQuizzes={groupedQuizzes}
            selectedQuiz={selectedQuiz}
            setSelectedQuiz={(quiz) => void chooseQuiz(quiz)}
            handleSync={handleSync}
            isSyncing={isSyncing}
            setIsSidebarOpen={setSidebarOpen}
            onOpenSettings={() => setSettingsOpen(true)}
          />
          <main
            className="main-content"
            id="main-content"
            ref={mainContentRef}
            onAuxClick={handleMainContentAuxClick}
            onMouseDown={handleMainContentMouseDown}
            onWheel={handleMainContentWheel}
          >
            <div
              aria-atomic="true"
              aria-live="polite"
              className="sr-only"
              role="status"
            >
              {autoScrollAnnouncement}
            </div>
            {autoScrollIndicator && (
              <div
                aria-hidden="true"
                className="auto-scroll-overlay"
                style={{
                  left: autoScrollIndicator.x,
                  top: autoScrollIndicator.y,
                }}
              >
                <span
                  className={
                    autoScrollIndicator.direction === "up"
                      ? "auto-scroll-arrow active"
                      : "auto-scroll-arrow"
                  }
                >
                  ↑
                </span>
                <span className="auto-scroll-center" />
                <span
                  className={
                    autoScrollIndicator.direction === "down"
                      ? "auto-scroll-arrow active"
                      : "auto-scroll-arrow"
                  }
                >
                  ↓
                </span>
              </div>
            )}
            {settingsOpen && (
              <Suspense
                fallback={
                  <div style={{ padding: "2rem" }}>Loading Settings...</div>
                }
              >
                <SettingsView
                  onClose={() => setSettingsOpen(false)}
                  theme={theme}
                  accent={accent}
                  textColor={textColor}
                  onSaveSuccess={() => showToast("Settings saved!")}
                  onSaveError={showToast}
                  onThemeChange={(v) => void saveTheme(v)}
                  onAccentChange={(v) => void saveAccent(v)}
                  onTextColorChange={(v) => void saveTextColor(v)}
                  updateAvailable={updateVersion}
                  onDirtyChange={setSettingsDirty}
                  basePath={basePath}
                  onSelectFolder={async () => {
                    if (isIOS) return selectIosFolder("quiz");
                    setFolderPurpose("quiz");
                    const { open } = await import("@tauri-apps/plugin-dialog");
                    try {
                      const selected = await open({
                        directory: true,
                        multiple: false,
                        recursive: true,
                        fileAccessMode: "scoped",
                      });
                      if (typeof selected === "string")
                        return updateBasePath(selected);
                      if (!isIOS) return;
                    } catch {
                      if (isIOS)
                        return showToast(
                          "Unable to open the iOS Files picker. Please try again.",
                        );
                    }
                    setFolderBrowserOpen(true);
                  }}
                  onSelectVaultFolder={async () => {
                    if (isIOS) return selectIosFolder("vault");
                    const { open } = await import("@tauri-apps/plugin-dialog");
                    try {
                      const selected = await open({
                        directory: true,
                        multiple: false,
                        recursive: true,
                        fileAccessMode: "scoped",
                      });
                      if (typeof selected === "string") {
                        setSelectedVaultFolder(selected);
                        showToast("Obsidian vault folder selected.");
                      }
                    } catch {
                      showToast("Unable to open the folder picker.");
                    }
                  }}
                  selectedVaultFolder={selectedVaultFolder}
                  onUpdateBasePath={(path) => void updateBasePath(path)}
                />
              </Suspense>
            )}
            <div
              style={{
                display: settingsOpen ? "none" : "flex",
                flexDirection: "column",
                flex: 1,
              }}
            >
              {!basePath ? (
                <div className="empty-state">
                  <h2 className="empty-state-title">Select Quiz Folder</h2>
                  <p>
                    Please select a directory containing your Markdown quizzes.
                  </p>
                  <button
                    className="primary-btn"
                    onClick={async () => {
                      if (isIOS) return selectIosFolder("quiz");
                      const { open } = await import(
                        "@tauri-apps/plugin-dialog"
                      );
                      const selected = await open({
                        directory: true,
                        multiple: false,
                        recursive: true,
                        fileAccessMode: "scoped",
                      });
                      if (typeof selected === "string") {
                        await updateBasePath(selected);
                      }
                    }}
                  >
                    Choose Folder
                  </button>
                </div>
              ) : selectedQuiz ? (
                <QuizViewer
                  selectedQuiz={selectedQuiz}
                  activeQuiz={activeQuiz}
                  activeWorksheet={activeWorksheet}
                  loadingActiveQuiz={loadingActiveQuiz}
                  resetKey={resetKey}
                  onReset={() => setResetKey((k) => k + 1)}
                  onSchedule={() => setScheduleOpen(true)}
                  {...session}
                />
              ) : (
                <div className="empty-state">
                  <h2 className="empty-state-title">Select a Quiz</h2>
                  <p>
                    Choose a topic from the sidebar to begin testing your
                    knowledge.
                  </p>
                </div>
              )}
            </div>
          </main>
        </div>
        {scheduleOpen && (
          <Suspense fallback={null}>
            <ScheduleModal
              isOpen={scheduleOpen}
              onClose={() => setScheduleOpen(false)}
              quiz={selectedQuiz}
              onSuccess={(date) => showToast(`Task scheduled for ${date}!`)}
              onCheckResult={showToast}
            />
          </Suspense>
        )}
        <FolderBrowserModal
          isOpen={folderBrowserOpen && !isIOS}
          onClose={() => setFolderBrowserOpen(false)}
          initialPath={basePath}
          onSelectFolder={(path) => {
            if (folderPurpose === "vault") {
              setSelectedVaultFolder(path);
              showToast("Obsidian vault folder selected.");
            } else {
              void updateBasePath(path);
              showToast("Quiz directory updated!");
            }
          }}
        />
        {toastMessage && (
          <div role="status" aria-live="polite" className="toast-notification">
            ✓ {toastMessage}
          </div>
        )}
      </div>
      <KeyboardShortcutsDialog
        isOpen={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </>
  );
}
