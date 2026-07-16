import { useEffect, useRef, useState, useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import { clsx } from "clsx";
import type { Quiz } from "../types";
import { APP_TITLE, DEFAULT_TOPIC } from "../constants";

interface SidebarProps {
  isSidebarOpen: boolean;
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  loading: boolean;
  groupedQuizzes: Record<string, Quiz[]>;
  selectedQuiz: Quiz | null;
  setSelectedQuiz: Dispatch<SetStateAction<Quiz | null>>;
  handleSync: () => void;
  isSyncing: boolean;
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
}: SidebarProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [focusedQuizIndex, setFocusedQuizIndex] = useState<number>(0);

  const flatQuizzes = useMemo(() => {
    return (
      Object.entries(groupedQuizzes)
        .sort(([a], [b]) => a.localeCompare(b))
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .flatMap(([_, quizzes]) => quizzes)
    );
  }, [groupedQuizzes]);

  useEffect(() => {
    // eslint-disable-next-line
    setFocusedQuizIndex(0);
  }, [searchQuery]);

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
        setSelectedQuiz(quizToOpen);
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <aside className={clsx("sidebar", !isSidebarOpen && "closed")}>
      <div className="sidebar-header">
        <h2>{APP_TITLE}</h2>
        <button
          className="sync-button"
          onClick={handleSync}
          disabled={isSyncing}
          title="Sync Quizzes"
        >
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
            style={{
              animation: isSyncing ? "spin 1s linear infinite" : "none",
            }}
          >
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-9.21l-3.34 3.34" />
          </svg>
        </button>
      </div>
      <hr className="sidebar-divider" />
      <div className="search-container">
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
          placeholder="Search by topic or title..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleInputKeyDown}
        />
      </div>
      <hr className="sidebar-divider" />
      <div className="sidebar-content">
        {loading ? (
          <div className="loading">Loading quizzes...</div>
        ) : Object.keys(groupedQuizzes).length === 0 ? (
          <div
            className="sidebar-empty"
            style={{
              padding: "1rem",
              color: "var(--text-secondary)",
              textAlign: "center",
              fontSize: "0.9rem",
            }}
          >
            {searchQuery
              ? "No quizzes match your search."
              : "No quizzes found in this folder."}
          </div>
        ) : (
          Object.entries(groupedQuizzes)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([topic, topicQuizzes]) => (
              <div key={topic} className="topic-group">
                <div className="topic-title">{topic || DEFAULT_TOPIC}</div>
                {topicQuizzes.map((quiz) => (
                  <div
                    key={quiz.path}
                    className={clsx(
                      "quiz-item",
                      selectedQuiz?.path === quiz.path && "active",
                      flatQuizzes[focusedQuizIndex]?.path === quiz.path &&
                        "focused",
                    )}
                    onClick={() => setSelectedQuiz(quiz)}
                  >
                    {quiz.title}
                  </div>
                ))}
              </div>
            ))
        )}
      </div>
    </aside>
  );
}
