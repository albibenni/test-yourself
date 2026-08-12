import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";

interface FolderItem {
  name: string;
  path: string;
  is_dir: boolean;
  md_count: number;
}

interface DirectoryListing {
  current_path: string;
  parent_path: string | null;
  items: FolderItem[];
}

interface FolderBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFolder: (folderPath: string) => void;
  initialPath?: string | null;
}

export function FolderBrowserModal({
  isOpen,
  onClose,
  onSelectFolder,
  initialPath,
}: FolderBrowserModalProps) {
  const [currentPath, setCurrentPath] = useState<string | null>(
    initialPath || null,
  );
  const [listing, setListing] = useState<DirectoryListing | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const previousFocus = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchDirectory = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await invoke<DirectoryListing>("browse_directory", {
          path: currentPath,
        });
        if (isMounted) {
          setListing(result);
          setCurrentPath(result.current_path);
        }
      } catch (err) {
        if (isMounted) {
          setError(typeof err === "string" ? err : "Failed to load directory");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void fetchDirectory();

    return () => {
      isMounted = false;
    };
  }, [isOpen, currentPath]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        className="modal-content"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="folder-browser-title"
        tabIndex={-1}
        style={{
          width: "100%",
          maxWidth: "540px",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-color)",
          borderRadius: "0.875rem",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "1rem 1.25rem",
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h2
              id="folder-browser-title"
              style={{
                margin: 0,
                fontSize: "1.15rem",
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              Browse Folders
            </h2>
            <p
              style={{
                margin: "0.25rem 0 0 0",
                fontSize: "0.8125rem",
                color: "var(--text-secondary)",
              }}
            >
              Navigate to your Markdown quiz directory.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="top-bar-btn"
            style={{ width: "32px", height: "32px" }}
            aria-label="Close Folder Browser"
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
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Quick Location Shortcuts */}
        <div
          style={{
            padding: "0.5rem 1.25rem",
            backgroundColor:
              "color-mix(in srgb, var(--text-primary) 2%, transparent)",
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            gap: "0.5rem",
            overflowX: "auto",
          }}
        >
          <button
            className="button-secondary"
            onClick={() => setCurrentPath("documents")}
            style={{
              padding: "0.25rem 0.625rem",
              fontSize: "0.75rem",
              minHeight: "32px",
              whiteSpace: "nowrap",
            }}
          >
            📱 On My iPhone (Documents)
          </button>
        </div>

        {/* Current Path Bar & Go Up Control */}
        <div
          style={{
            padding: "0.75rem 1.25rem",
            backgroundColor:
              "color-mix(in srgb, var(--text-primary) 3%, transparent)",
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <button
            className="button-secondary"
            disabled={!listing?.parent_path || loading}
            onClick={() => {
              if (listing?.parent_path) {
                setCurrentPath(listing.parent_path);
              }
            }}
            style={{
              padding: "0.375rem 0.625rem",
              fontSize: "0.8125rem",
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
              minHeight: "36px",
            }}
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
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
            Up
          </button>
          <div
            style={{
              flex: 1,
              fontFamily: "monospace",
              fontSize: "0.8125rem",
              color: "var(--text-primary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              direction: "rtl",
              textAlign: "left",
              opacity: 0.9,
            }}
            title={currentPath || ""}
          >
            {currentPath ? `\u200E${currentPath}` : "Loading path..."}
          </div>
        </div>

        {/* Folder Content List */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "0.5rem",
            minHeight: "220px",
          }}
        >
          {loading ? (
            <div
              style={{
                padding: "2rem",
                textAlign: "center",
                color: "var(--text-secondary)",
                fontSize: "0.875rem",
              }}
            >
              Loading directory content...
            </div>
          ) : error ? (
            <div
              style={{
                padding: "2rem",
                textAlign: "center",
                color: "var(--error-color, #ef4444)",
                fontSize: "0.875rem",
              }}
            >
              {error}
            </div>
          ) : listing?.items.length === 0 ? (
            <div
              style={{
                padding: "2rem",
                textAlign: "center",
                color: "var(--text-secondary)",
                fontSize: "0.875rem",
              }}
            >
              No subfolders or quiz files in this folder.
            </div>
          ) : (
            listing?.items.map((item) => (
              <button
                key={item.path}
                onClick={() => {
                  if (item.is_dir) {
                    setCurrentPath(item.path);
                  }
                }}
                disabled={!item.is_dir}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.75rem 1rem",
                  background: "transparent",
                  border: "none",
                  borderRadius: "0.5rem",
                  color: "var(--text-primary)",
                  textAlign: "left",
                  cursor: item.is_dir ? "pointer" : "default",
                  opacity: item.is_dir ? 1 : 0.6,
                  transition: "background-color 0.15s ease",
                  minHeight: "44px",
                }}
                onMouseEnter={(e) => {
                  if (item.is_dir) {
                    e.currentTarget.style.backgroundColor =
                      "color-mix(in srgb, var(--text-primary) 6%, transparent)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <div
                  style={{
                    fontSize: "1.25rem",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {item.is_dir ? "📁" : "📄"}
                </div>
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <div
                    style={{
                      fontWeight: item.is_dir ? 600 : 400,
                      fontSize: "0.9rem",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.name}
                  </div>
                </div>
                {item.is_dir && item.md_count > 0 && (
                  <span
                    style={{
                      fontSize: "0.75rem",
                      padding: "0.2rem 0.5rem",
                      borderRadius: "0.25rem",
                      backgroundColor: "var(--accent-color)",
                      color: "#ffffff",
                      fontWeight: 600,
                    }}
                  >
                    {item.md_count} {item.md_count === 1 ? "quiz" : "quizzes"}
                  </span>
                )}
                {item.is_dir && (
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
                    style={{ opacity: 0.5 }}
                  >
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer Action Bar */}
        <div
          style={{
            padding: "1rem 1.25rem",
            borderTop: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
            backgroundColor: "var(--bg-surface)",
          }}
        >
          <button
            className="button-secondary"
            onClick={onClose}
            style={{ minHeight: "44px", flex: 1 }}
          >
            Cancel
          </button>
          <button
            className="button-primary"
            disabled={!currentPath}
            onClick={() => {
              if (currentPath) {
                onSelectFolder(currentPath);
                onClose();
              }
            }}
            style={{ minHeight: "44px", flex: 2 }}
          >
            Select This Folder
          </button>
        </div>
      </div>
    </div>
  );
}
