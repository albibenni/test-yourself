import { useEffect, useRef, useState, useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import { clsx } from "clsx";
import type { QuizMetadata } from "../types";
import { APP_TITLE, DEFAULT_TOPIC } from "../constants";

interface SidebarProps {
  isSidebarOpen: boolean;
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  loading: boolean;
  groupedQuizzes: Record<string, QuizMetadata[]>;
  selectedQuiz: QuizMetadata | null;
  setSelectedQuiz: Dispatch<SetStateAction<QuizMetadata | null>>;
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
  const [activeTab, setActiveTab] = useState<"quizzes" | "worksheets">(
    "quizzes",
  );

  useEffect(() => {
    if (selectedQuiz) {
      if (selectedQuiz.is_worksheet) {
        setTimeout(() => setActiveTab("worksheets"), 0);
      } else {
        setTimeout(() => setActiveTab("quizzes"), 0);
      }
    }
  }, [selectedQuiz]);

  const filteredGroupedQuizzes = useMemo(() => {
    const filtered: Record<string, QuizMetadata[]> = {};
    for (const [topic, quizzes] of Object.entries(groupedQuizzes)) {
      const matching = quizzes.filter((q) =>
        activeTab === "quizzes" ? !q.is_worksheet : q.is_worksheet,
      );
      if (matching.length > 0) {
        filtered[topic] = matching;
      }
    }
    return filtered;
  }, [groupedQuizzes, activeTab]);

  const flatQuizzes = useMemo(() => {
    return Object.entries(filteredGroupedQuizzes)
      .sort(([a], [b]) => a.localeCompare(b))
      .flatMap(([, quizzes]) => quizzes);
  }, [filteredGroupedQuizzes]);

  const [prevSearchQuery, setPrevSearchQuery] = useState(searchQuery);
  if (searchQuery !== prevSearchQuery) {
    setPrevSearchQuery(searchQuery);
    setFocusedQuizIndex(0);
  }

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
          aria-label="Sync Quizzes"
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
          placeholder="Search..."
          aria-label="Search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleInputKeyDown}
        />
      </div>
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--border-color)",
          margin: "0",
        }}
      >
        <button
          style={{
            flex: 1,
            padding: "0.75rem 0.5rem",
            background: "none",
            border: "none",
            borderBottom:
              activeTab === "quizzes"
                ? "2px solid var(--accent-color)"
                : "2px solid transparent",
            color:
              activeTab === "quizzes"
                ? "var(--text-primary)"
                : "var(--text-secondary)",
            fontWeight: activeTab === "quizzes" ? 600 : 400,
            cursor: "pointer",
            transition: "all 0.2s",
            fontSize: "0.9rem",
          }}
          onClick={() => {
            setActiveTab("quizzes");
            setFocusedQuizIndex(0);
          }}
        >
          Quizzes
        </button>
        <button
          style={{
            flex: 1,
            padding: "0.75rem 0.5rem",
            background: "none",
            border: "none",
            borderBottom:
              activeTab === "worksheets"
                ? "2px solid var(--accent-color)"
                : "2px solid transparent",
            color:
              activeTab === "worksheets"
                ? "var(--text-primary)"
                : "var(--text-secondary)",
            fontWeight: activeTab === "worksheets" ? 600 : 400,
            cursor: "pointer",
            transition: "all 0.2s",
            fontSize: "0.9rem",
          }}
          onClick={() => {
            setActiveTab("worksheets");
            setFocusedQuizIndex(0);
          }}
        >
          Worksheets
        </button>
      </div>
      <hr className="sidebar-divider" style={{ marginTop: 0 }} />
      <div className="sidebar-content">
        {loading ? (
          <div className="loading">Loading...</div>
        ) : Object.keys(filteredGroupedQuizzes).length === 0 ? (
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
              ? `No ${activeTab} match your search.`
              : `No ${activeTab} found in this folder.`}
          </div>
        ) : (
          Object.entries(filteredGroupedQuizzes)
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
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedQuiz(quiz)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedQuiz(quiz);
                      }
                    }}
                  >
                    {quiz.title}
                  </div>
                ))}
              </div>
            ))
        )}
      </div>
      <hr className="sidebar-divider" />
      <div
        className="sidebar-footer"
        style={{
          padding: "0.75rem 1.5rem",
          fontSize: "0.8125rem",
          color: "var(--text-secondary)",
          textAlign: "center",
          backgroundColor:
            "color-mix(in srgb, var(--text-primary) 2%, transparent)",
        }}
      >
        {flatQuizzes.length}{" "}
        {flatQuizzes.length === 1
          ? activeTab === "quizzes"
            ? "quiz"
            : "worksheet"
          : activeTab}
      </div>
    </aside>
  );
}
