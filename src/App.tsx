import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { type as osType } from "@tauri-apps/plugin-os";
import { check } from "@tauri-apps/plugin-updater";
import { useCallback, useEffect, useState } from "react";
import "./App.css";
import { AppLayout } from "./components/AppLayout";
import { useQuizSession } from "./hooks/useQuizSession";
import { useQuizzes } from "./hooks/useQuizzes";
import { useTheme } from "./hooks/useTheme";
import { completeTodoistAuthorization } from "./todoistOAuth";

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [folderBrowserOpen, setFolderBrowserOpen] = useState(false);
  const [folderPurpose, setFolderPurpose] = useState<"quiz" | "vault">("quiz");
  const [selectedVaultFolder, setSelectedVaultFolder] = useState<string | null>(
    null,
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [pendingLink, setPendingLink] = useState<string | null>(null);
  const isIOS = osType() === "ios";
  const {
    theme,
    accent,
    textColor,
    textScale,
    contrast,
    reducedMotion,
    saveTheme,
    saveAccent,
    saveTextColor,
    saveTextScale,
    saveContrast,
    saveReducedMotion,
  } = useTheme();
  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(null), 3000);
  }, []);
  const quizzes = useQuizzes();

  useEffect(() => {
    void check()
      .then((update) => {
        if (update) {
          setUpdateVersion(update.version);
          showToast(`Update v${update.version} is available!`);
        }
      })
      .catch(() => undefined);
  }, [showToast]);

  useEffect(() => {
    const parse = (value: unknown) => {
      const raw = Array.isArray(value)
        ? String(value[0] ?? "")
        : String(value ?? "");
      try {
        return new URL(raw).searchParams.get("quiz");
      } catch {
        return raw.match(/quiz=([^&]+)/)?.[1] ?? null;
      }
    };
    const handleDeepLink = async (value: unknown) => {
      const raw = Array.isArray(value)
        ? String(value[0] ?? "")
        : String(value ?? "");
      try {
        if (await completeTodoistAuthorization(raw)) {
          setSettingsOpen(true);
          showToast("Todoist connected.");
          return;
        }
      } catch (error) {
        showToast(
          error instanceof Error
            ? error.message
            : "Todoist authorization failed.",
        );
        return;
      }
      const path = parse(raw);
      if (path) setPendingLink(path);
    };
    let removeDeepLink: (() => void) | undefined;
    let removeEvent: (() => void) | undefined;
    void import("@tauri-apps/plugin-deep-link")
      .then(async ({ onOpenUrl }) => {
        removeDeepLink = await onOpenUrl((urls) => {
          void handleDeepLink(urls);
        });
        const initial = await invoke<string | null>("get_initial_url");
        await handleDeepLink(initial);
      })
      .catch(() => undefined);
    void listen<unknown>("deep-link-received", (event) => {
      void handleDeepLink(event.payload);
    }).then((remove) => {
      removeEvent = remove;
    });
    return () => {
      removeDeepLink?.();
      removeEvent?.();
    };
  }, [showToast]);

  useEffect(() => {
    if (!pendingLink || quizzes.quizzes.length === 0) return;
    const target = decodeURIComponent(pendingLink)
      .replace(/\\/g, "/")
      .toLowerCase();
    const match = quizzes.quizzes.find((quiz) => {
      const path = quiz.path.replace(/\\/g, "/").toLowerCase();
      const file = path.split("/").pop() ?? "";
      const stem = file.replace(/(\.worksheet)?\.md$/, "");
      const pendingFile = target.split("/").pop() ?? "";
      const pendingStem = pendingFile.replace(/(\.worksheet)?\.md$/, "");
      return (
        path === target ||
        path.endsWith(target) ||
        file === pendingFile ||
        stem === pendingStem ||
        quiz.title.toLowerCase() === pendingStem
      );
    });
    if (match) {
      quizzes.setSelectedQuizMeta(match);
      setPendingLink(null);
      setCreateOpen(false);
      setSettingsOpen(false);
    } else {
      showToast(`Quiz not found for deep link: ${target}`);
      alert(`Deep link quiz not found in library: ${target}`);
    }
  }, [pendingLink, quizzes.quizzes, quizzes.setSelectedQuizMeta, showToast]);

  const { questions: shuffledQuestions, ...session } = useQuizSession(
    quizzes.selectedQuizMeta
      ? `${quizzes.selectedQuizMeta.path}:${resetKey}`
      : undefined,
    quizzes.activeQuiz?.questions,
  );
  const selectIosFolder = useCallback(
    async (purpose: "quiz" | "vault") => {
      try {
        const selected = await invoke<string | null>("pick_ios_folder");
        if (!selected) return;
        await quizzes.updateBasePath(selected);
        if (purpose === "vault")
          setSelectedVaultFolder(
            selected.split("/").filter(Boolean).pop() ?? "Obsidian",
          );
        showToast("Obsidian folder selected.");
      } catch (error) {
        showToast(`Unable to open the iOS folder picker: ${String(error)}`);
      }
    },
    [quizzes.updateBasePath, showToast],
  );

  return (
    <AppLayout
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      settingsOpen={settingsOpen}
      setSettingsOpen={setSettingsOpen}
      createOpen={createOpen}
      setCreateOpen={setCreateOpen}
      settingsDirty={settingsDirty}
      setSettingsDirty={setSettingsDirty}
      scheduleOpen={scheduleOpen}
      setScheduleOpen={setScheduleOpen}
      folderBrowserOpen={folderBrowserOpen}
      setFolderBrowserOpen={setFolderBrowserOpen}
      folderPurpose={folderPurpose}
      setFolderPurpose={setFolderPurpose}
      selectedVaultFolder={selectedVaultFolder}
      setSelectedVaultFolder={setSelectedVaultFolder}
      isIOS={isIOS}
      toastMessage={toastMessage}
      showToast={showToast}
      updateVersion={updateVersion}
      theme={theme}
      accent={accent}
      textColor={textColor}
      textScale={textScale}
      contrast={contrast}
      reducedMotion={reducedMotion}
      saveTheme={saveTheme}
      saveAccent={saveAccent}
      saveTextColor={saveTextColor}
      saveTextScale={saveTextScale}
      saveContrast={saveContrast}
      saveReducedMotion={saveReducedMotion}
      selectIosFolder={selectIosFolder}
      basePath={quizzes.basePath}
      updateBasePath={quizzes.updateBasePath}
      searchQuery={quizzes.searchQuery}
      setSearchQuery={quizzes.setSearchQuery}
      loading={quizzes.loading}
      groupedQuizzes={quizzes.groupedQuizzes}
      quizzes={quizzes.quizzes}
      selectedQuiz={quizzes.selectedQuizMeta}
      setSelectedQuiz={quizzes.setSelectedQuizMeta}
      handleSync={() => void quizzes.handleSync()}
      isSyncing={quizzes.isSyncing}
      activeQuiz={
        quizzes.activeQuiz
          ? { ...quizzes.activeQuiz, questions: shuffledQuestions }
          : null
      }
      activeWorksheet={quizzes.activeWorksheet}
      activeScenario={quizzes.activeScenario}
      loadingActiveQuiz={quizzes.loadingActiveQuiz}
      resetKey={resetKey}
      setResetKey={setResetKey}
      session={session}
    />
  );
}

export default App;
