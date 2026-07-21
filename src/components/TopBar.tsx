import type { Dispatch, SetStateAction } from "react";
import { APP_TITLE } from "../constants";

interface TopBarProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: Dispatch<SetStateAction<boolean>>;
  selectFolder: () => void;
  onOpenSettings: () => void;
  hasUpdate?: boolean;
}

export function TopBar({
  isSidebarOpen,
  setIsSidebarOpen,
  selectFolder,
  onOpenSettings,
  hasUpdate,
}: TopBarProps) {
  return (
    <div className="top-bar" data-tauri-drag-region>
      <button
        className="top-bar-btn"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
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
      <button
        className="top-bar-btn"
        onClick={selectFolder}
        data-hint="Change Folder"
        aria-label="Change Folder"
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
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
      </button>
      <div className="top-bar-separator"></div>
      <div className="top-bar-title" data-tauri-drag-region>
        {APP_TITLE}
      </div>
      <div style={{ flex: 1 }} data-tauri-drag-region></div>
      <button
        className="top-bar-btn"
        onClick={onOpenSettings}
        data-hint="Settings"
        aria-label="Settings"
        style={{ position: 'relative' }}
      >
        {hasUpdate && (
          <span 
            style={{ 
              position: 'absolute', top: '2px', right: '2px', width: '6px', height: '6px', 
              backgroundColor: 'var(--error-color, #ef4444)', borderRadius: '50%', boxShadow: '0 0 0 2px var(--bg-color)' 
            }} 
          />
        )}
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
    </div>
  );
}
