import { Dispatch, SetStateAction } from "react";

interface TopBarProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: Dispatch<SetStateAction<boolean>>;
  selectFolder: () => void;
}

export function TopBar({ isSidebarOpen, setIsSidebarOpen, selectFolder }: TopBarProps) {
  return (
    <div className="top-bar" data-tauri-drag-region>
      <button
        className="top-bar-btn"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        data-hint="Toggle Sidebar"
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
        Brain Test
      </div>
    </div>
  );
}
