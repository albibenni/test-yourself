import { Dispatch, SetStateAction } from "react";
import { clsx } from "clsx";
import { Quiz } from "../types";

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
  return (
    <aside className={clsx("sidebar", !isSidebarOpen && "closed")}>
      <div className="sidebar-header">
        <h2>Brain Test</h2>
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
          type="text"
          className="search-input"
          placeholder="Search by topic or title..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      <hr className="sidebar-divider" />
      <div className="sidebar-content">
        {loading ? (
          <div className="loading">Loading quizzes...</div>
        ) : (
          Object.entries(groupedQuizzes)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([topic, topicQuizzes]) => (
              <div key={topic} className="topic-group">
                <div className="topic-title">{topic || "General"}</div>
                {topicQuizzes.map((quiz) => (
                  <div
                    key={quiz.path}
                    className={clsx(
                      "quiz-item",
                      selectedQuiz?.path === quiz.path && "active",
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
