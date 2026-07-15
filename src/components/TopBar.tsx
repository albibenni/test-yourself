import { Dispatch, SetStateAction } from "react";

interface TopBarProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: Dispatch<SetStateAction<boolean>>;
}

export function TopBar({ isSidebarOpen, setIsSidebarOpen }: TopBarProps) {
  return (
    <div className="top-bar" data-tauri-drag-region>
      <button
        className="top-bar-btn"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        title="Toggle Sidebar"
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
      <div className="top-bar-title" data-tauri-drag-region>
        tauri-app
      </div>
    </div>
  );
}
