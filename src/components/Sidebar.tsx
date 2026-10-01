import { clsx } from "clsx";
import type { Dispatch, SetStateAction } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { APP_TITLE, DEFAULT_TOPIC } from "../constants";
import type { QuizMetadata } from "../types";
import { StatusView } from "./StatusView";

interface SidebarProps {
  isSidebarOpen: boolean;
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  loading: boolean;
  groupedQuizzes: Record<string, QuizMetadata[]>;
  selectedQuiz: QuizMetadata | null;
  setSelectedQuiz: (quiz: QuizMetadata) => void;
  handleSync: () => void;
  isSyncing: boolean;
  setIsSidebarOpen: Dispatch<SetStateAction<boolean>>;
  onOpenSettings?: () => void;
}

export function Sidebar({
  isSidebarOpen,
  searchQuery,
  setSearchQuery,
  loading,
  groupedQuizzes,
  selectedQuiz,
  setSelectedQuiz,
  handleSync,
  isSyncing,
  setIsSidebarOpen,
  onOpenSettings,
}: SidebarProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [focusedQuizIndex, setFocusedQuizIndex] = useState<number>(0);
  const [collapsedTopics, setCollapsedTopics] = useState<Set<string>>(
    () => new Set(),
  );
  const [activeTab, setActiveTab] = useState<
    "quizzes" | "worksheets" | "questions"
  >("quizzes");

  useEffect(() => {
    if (selectedQuiz) {
      if (selectedQuiz.is_worksheet) {
        setTimeout(() => setActiveTab("worksheets"), 0);
      } else if (selectedQuiz.is_question) {
        setTimeout(() => setActiveTab("questions"), 0);
      } else {
        setTimeout(() => setActiveTab("quizzes"), 0);
      }
    }
  }, [selectedQuiz]);

  const filteredGroupedQuizzes = useMemo(() => {
    const filtered: Record<string, QuizMetadata[]> = {};
    for (const [topic, quizzes] of Object.entries(groupedQuizzes)) {
      const matching = quizzes.filter((q) => {
        if (activeTab === "worksheets") return q.is_worksheet;
        if (activeTab === "questions") return q.is_question;
        return !q.is_worksheet && !q.is_question;
      });
      if (matching.length > 0) {
        filtered[topic] = matching;
      }
    }
    return filtered;
  }, [groupedQuizzes, activeTab]);

  const flatQuizzes = useMemo(() => {
    return Object.entries(filteredGroupedQuizzes)
      .sort(([a], [b]) => a.localeCompare(b))
      .flatMap(([topic, quizzes]) =>
        collapsedTopics.has(topic) && !searchQuery ? [] : quizzes,
      );
  }, [collapsedTopics, filteredGroupedQuizzes, searchQuery]);

  const filteredQuizCount = useMemo(
    () =>
      Object.values(filteredGroupedQuizzes).reduce(
        (total, quizzes) => total + quizzes.length,
        0,
      ),
    [filteredGroupedQuizzes],
  );

  const toggleTopic = (topic: string) => {
    setCollapsedTopics((current) => {
      const next = new Set(current);
      if (next.has(topic)) next.delete(topic);
      else next.add(topic);
      return next;
    });
    setFocusedQuizIndex(0);
  };

  const handleSelectQuiz = (quizToOpen: QuizMetadata) => {
    setSelectedQuiz(quizToOpen);
    if (window.innerWidth <= 768) {
      setIsSidebarOpen(false);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (flatQuizzes.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedQuizIndex((prev) => Math.min(prev + 1, flatQuizzes.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedQuizIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const quizToOpen = flatQuizzes[focusedQuizIndex];
      if (quizToOpen) {
        handleSelectQuiz(quizToOpen);
      }
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: setIsSidebarOpen is a stable setState dispatch
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setIsSidebarOpen(true);
        // Add a small delay to allow the sidebar to become visible before focusing
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 50);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <aside className={clsx("sidebar", !isSidebarOpen && "closed")}>
      <div className="sidebar-header">
        <button
          className="top-bar-btn"
          onClick={() => setIsSidebarOpen(false)}
          data-hint="Toggle Sidebar"
          aria-label="Toggle Sidebar"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="9" y1="3" x2="9" y2="21"></line>
          </svg>
        </button>
        <div className="top-bar-separator"></div>
        <div className="top-bar-title">{APP_TITLE}</div>
        <div style={{ flex: 1 }} />
        {onOpenSettings && (
          <button
            className="top-bar-btn"
            onClick={() => {
              setIsSidebarOpen(false);
              onOpenSettings();
            }}
            data-hint="Settings"
            aria-label="Settings"
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
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
        )}
      </div>
      <div className="search-container">
        <div className="search-input-wrapper">
          <svg
            className="search-icon"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            className="search-input"
            placeholder="Search..."
            aria-label="Search"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setFocusedQuizIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
          />
        </div>
        <button
          className="sync-button"
          onClick={handleSync}
          disabled={isSyncing}
          title="Sync Quizzes"
          aria-label="Sync Quizzes"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              animation: isSyncing ? "spin 1s linear infinite" : "none",
            }}
          >
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-9.21l-3.34 3.34" />
          </svg>
        </button>
      </div>
      <div className="sidebar-tabs">
        <button
          className={clsx("sidebar-tab", activeTab === "quizzes" && "active")}
          aria-pressed={activeTab === "quizzes"}
          onClick={() => {
            setActiveTab("quizzes");
            setFocusedQuizIndex(0);
          }}
        >
          Quizzes
        </button>
        <button
          className={clsx(
            "sidebar-tab",
            activeTab === "worksheets" && "active",
          )}
          aria-pressed={activeTab === "worksheets"}
          onClick={() => {
            setActiveTab("worksheets");
            setFocusedQuizIndex(0);
          }}
        >
          Worksheets
        </button>
        <button
          className={clsx("sidebar-tab", activeTab === "questions" && "active")}
          aria-pressed={activeTab === "questions"}
          onClick={() => {
            setActiveTab("questions");
            setFocusedQuizIndex(0);
          }}
        >
          Questions
        </button>
      </div>
      <hr className="sidebar-divider" style={{ marginTop: 0 }} />
      <div className="sidebar-content">
        {loading ? (
          <StatusView compact kind="loading">
            Loading...
          </StatusView>
        ) : Object.keys(filteredGroupedQuizzes).length === 0 ? (
          <StatusView compact kind="quiz">
            {searchQuery
              ? `No ${activeTab} match your search.`
              : `No ${activeTab} found in this folder.`}
          </StatusView>
        ) : (
          Object.entries(filteredGroupedQuizzes)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([topic, topicQuizzes]) => {
              const isCollapsed = collapsedTopics.has(topic) && !searchQuery;
              const itemLabel =
                activeTab === "quizzes"
                  ? topicQuizzes.length === 1
                    ? "quiz"
                    : "quizzes"
                  : activeTab === "worksheets"
                    ? topicQuizzes.length === 1
                      ? "worksheet"
                      : "worksheets"
                    : topicQuizzes.length === 1
                      ? "question"
                      : "questions";

              return (
                <div key={topic} className="topic-group">
                  <button
                    className="topic-title"
                    type="button"
                    aria-expanded={!isCollapsed}
                    onClick={() => toggleTopic(topic)}
                  >
                    <span>{topic || DEFAULT_TOPIC}</span>
                    <span className="topic-count">
                      {topicQuizzes.length} {itemLabel}
                    </span>
                    <svg
                      aria-hidden="true"
                      className="topic-chevron"
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                    >
                      <path
                        d="m6 9 6 6 6-6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  {!isCollapsed &&
                    topicQuizzes.map((quiz) => (
                      <button
                        key={quiz.path}
                        className={clsx(
                          "quiz-item",
                          selectedQuiz?.path === quiz.path && "active",
                          flatQuizzes[focusedQuizIndex]?.path === quiz.path &&
                            "focused",
                        )}
                        type="button"
                        aria-current={
                          selectedQuiz?.path === quiz.path ? "page" : undefined
                        }
                        onClick={() => handleSelectQuiz(quiz)}
                      >
                        {quiz.title}
                      </button>
                    ))}
                </div>
              );
            })
        )}
      </div>
      <hr className="sidebar-divider" />
      <div className="sidebar-footer">
        {filteredQuizCount}{" "}
        {filteredQuizCount === 1
          ? activeTab === "quizzes"
            ? "quiz"
            : activeTab === "worksheets"
              ? "worksheet"
              : "question"
          : activeTab}
      </div>
    </aside>
  );
}
