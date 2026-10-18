import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { type as osType } from "@tauri-apps/plugin-os";
import { check } from "@tauri-apps/plugin-updater";
import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";

import "./styles/Foundation.css";
import "./components/AppLayout.css";
import "./components/Sidebar.css";
import "./components/QuizViewer.css";
import "./components/QuestionCard.css";
import "./components/AppNotifications.css";
import "./components/StatusView.css";
import "./components/ScheduleModal.css";
import "./styles/TextTones.css";
import { AppLayout } from "./components/AppLayout";
import { useQuizSession } from "./hooks/useQuizSession";
import { useQuizzes } from "./hooks/useQuizzes";
import { useTheme } from "./hooks/useTheme";
import {
  type Assessment,
  completeAndSaveReview,
  getReviewSet,
  type ReviewRecommendation,
  syncLearningProgress,
  updateReviewSchedule,
} from "./learning/reviewProgress";
import { NullableStringSchema, type QuizMetadata } from "./schemas";
import { completeTodoistAuthorization } from "./todoistOAuth";

const DeepLinkValueSchema = z
  .union([z.string(), z.array(z.string()).min(1)])
  .transform((value) => (Array.isArray(value) ? value[0] : value));

function getDeepLinkValue(value: unknown): string {
  return DeepLinkValueSchema.safeParse(value).data ?? "";
}

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
  const [activeReviewSet, setActiveReviewSet] =
    useState<ReviewRecommendation | null>(null);
  const [recommendation, setRecommendation] =
    useState<ReviewRecommendation | null>(null);
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
  useEffect(() => {
    setRecommendation(null);
  }, [resetKey]);
  const quizzes = useQuizzes();
  const {
    quizzes: quizMetadata,
    setSelectedQuizMeta,
    updateBasePath,
  } = quizzes;

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
      const raw = getDeepLinkValue(value);
      try {
        const url = new URL(raw);
        const reviewSetId = url.searchParams.get("set");
        if (reviewSetId) {
          const reviewSet = getReviewSet(reviewSetId);
          if (reviewSet) return { path: reviewSet.quizPath, reviewSet };
          return null;
        }
        const path = url.searchParams.get("quiz");
        return path ? { path, reviewSet: null } : null;
      } catch {
        const path = raw.match(/quiz=([^&]+)/)?.[1];
        return path ? { path, reviewSet: null } : null;
      }
    };
    const handleDeepLink = async (value: unknown) => {
      const raw = getDeepLinkValue(value);
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
      try {
        await syncLearningProgress();
      } catch (error) {
        console.warn(
          "Unable to sync learning progress from the quiz folder:",
          error,
        );
      }
      const target = parse(raw);
      if (target) {
        setActiveReviewSet(target.reviewSet);
        setRecommendation(null);
        setPendingLink(target.path);
      } else if (raw.includes("set=")) {
        showToast("This saved review set is no longer available.");
      }
    };
    let disposed = false;
    let removeDeepLink: (() => void) | undefined;
    let removeEvent: (() => void) | undefined;
    void import("@tauri-apps/plugin-deep-link")
      .then(async ({ getCurrent, onOpenUrl }) => {
        const remove = await onOpenUrl((urls) => {
          void handleDeepLink(urls);
        });
        if (disposed) {
          remove();
          return;
        }
        removeDeepLink = remove;
        const initial =
          (await getCurrent()) ?? (await invoke("get_initial_url"));
        await handleDeepLink(initial);
      })
      .catch(() => undefined);
    void listen<unknown>("deep-link-received", (event) => {
      void handleDeepLink(event.payload);
    }).then((remove) => {
      removeEvent = remove;
    });
    const handleWindowFocus = () => {
      void invoke("get_initial_url")
        .then(handleDeepLink)
        .catch(() => undefined);
    };
    window.addEventListener("focus", handleWindowFocus);
    return () => {
      disposed = true;
      removeDeepLink?.();
      removeEvent?.();
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [showToast]);

  useEffect(() => {
    if (!pendingLink || quizMetadata.length === 0) return;
    const target = decodeURIComponent(pendingLink)
      .replace(/\\/g, "/")
      .toLowerCase();
    const match = quizMetadata.find((quiz) => {
      const path = quiz.path.replace(/\\/g, "/").toLowerCase();
      const file = path.split("/").pop() ?? "";
      const stem = file.replace(/(\.(?:worksheet|question))?\.md$/, "");
      const pendingFile = target.split("/").pop() ?? "";
      const pendingStem = pendingFile.replace(
        /(\.(?:worksheet|question))?\.md$/,
        "",
      );
      return (
        path === target ||
        path.endsWith(target) ||
        file === pendingFile ||
        stem === pendingStem ||
        quiz.title.toLowerCase() === pendingStem
      );
    });
    if (match) {
      setSelectedQuizMeta(match);
      setPendingLink(null);
      setCreateOpen(false);
      setSettingsOpen(false);
    } else {
      showToast(`Quiz not found for deep link: ${target}`);
      alert(`Deep link quiz not found in library: ${target}`);
    }
  }, [pendingLink, quizMetadata, setSelectedQuizMeta, showToast]);

  const filteredQuiz = useMemo(() => {
    if (!quizzes.activeQuiz || !activeReviewSet) return quizzes.activeQuiz;
    if (activeReviewSet.quizPath !== quizzes.activeQuiz.path)
      return quizzes.activeQuiz;
    const ids = new Set(activeReviewSet.questionIds);
    return {
      ...quizzes.activeQuiz,
      questions: quizzes.activeQuiz.questions.filter((question) =>
        ids.has(question.id),
      ),
    };
  }, [activeReviewSet, quizzes.activeQuiz]);
  const filteredQuestionDocument = useMemo(() => {
    if (!quizzes.activeQuestionDocument || !activeReviewSet)
      return quizzes.activeQuestionDocument;
    if (activeReviewSet.quizPath !== quizzes.activeQuestionDocument.path)
      return quizzes.activeQuestionDocument;
    const ids = new Set(activeReviewSet.questionIds);
    return {
      ...quizzes.activeQuestionDocument,
      questions: quizzes.activeQuestionDocument.questions.filter((question) =>
        ids.has(String(question.id)),
      ),
    };
  }, [activeReviewSet, quizzes.activeQuestionDocument]);
  const { questions: shuffledQuestions, ...quizSession } = useQuizSession(
    quizzes.selectedQuizMeta
      ? `${quizzes.selectedQuizMeta.path}:${activeReviewSet?.id ?? "full"}:${resetKey}`
      : undefined,
    filteredQuiz?.questions,
  );
  const handleSessionComplete = useCallback(
    (assessments: Record<string, Assessment>) => {
      const selected = quizzes.selectedQuizMeta;
      if (!selected || selected.is_worksheet) return;
      const allQuestionIds = selected.is_question
        ? (quizzes.activeQuestionDocument?.questions.map((question) =>
            String(question.id),
          ) ?? [])
        : (quizzes.activeQuiz?.questions.map((question) => question.id) ?? []);
      if (allQuestionIds.length === 0) return;
      const nextRecommendation = completeAndSaveReview({
        allQuestionIds,
        assessments,
        contentKind: selected.is_question ? "question" : "quiz",
        quizPath: selected.path,
        scope: activeReviewSet?.scope ?? "full",
      });
      setRecommendation(nextRecommendation);
      void syncLearningProgress()
        .then((data) => {
          const synced = data.reviewSets.find(
            (reviewSet) => reviewSet.id === nextRecommendation.id,
          );
          if (synced) setRecommendation(synced);
        })
        .catch((error) =>
          console.warn("Unable to sync completed review:", error),
        );
    },
    [
      activeReviewSet?.scope,
      quizzes.activeQuestionDocument?.questions,
      quizzes.activeQuiz?.questions,
      quizzes.selectedQuizMeta,
    ],
  );
  const selectQuiz = useCallback(
    (quiz: QuizMetadata) => {
      setActiveReviewSet(null);
      setRecommendation(null);
      setSelectedQuizMeta(quiz);
    },
    [setSelectedQuizMeta],
  );
  const handleReviewScheduled = useCallback(
    (dueDate: string) => {
      if (!recommendation) return;
      const updated = updateReviewSchedule(recommendation.id, dueDate);
      if (updated) setRecommendation(updated);
      void syncLearningProgress().catch((error) =>
        console.warn("Unable to sync the updated review schedule:", error),
      );
    },
    [recommendation],
  );
  const selectIosFolder = useCallback(
    async (purpose: "quiz" | "vault") => {
      try {
        const selected = NullableStringSchema.parse(
          await invoke("pick_ios_folder"),
        );
        if (!selected) return;
        await updateBasePath(selected);
        if (purpose === "vault")
          setSelectedVaultFolder(
            selected.split("/").filter(Boolean).pop() ?? "Obsidian",
          );
        showToast("Obsidian folder selected.");
      } catch (error) {
        showToast(`Unable to open the iOS folder picker: ${String(error)}`);
      }
    },
    [updateBasePath, showToast],
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
      setSelectedQuiz={selectQuiz}
      handleSync={() => {
        void Promise.all([quizzes.handleSync(), syncLearningProgress()]).catch(
          (error) => console.warn("Unable to sync learning progress:", error),
        );
      }}
      isSyncing={quizzes.isSyncing}
      activeQuiz={
        filteredQuiz ? { ...filteredQuiz, questions: shuffledQuestions } : null
      }
      activeWorksheet={quizzes.activeWorksheet}
      activeQuestionDocument={filteredQuestionDocument}
      loadingActiveQuiz={quizzes.loadingActiveQuiz}
      resetKey={resetKey}
      setResetKey={setResetKey}
      onReviewScheduled={handleReviewScheduled}
      session={{
        ...quizSession,
        onSessionComplete: handleSessionComplete,
        recommendation: recommendation ?? undefined,
      }}
    />
  );
}

export default App;
