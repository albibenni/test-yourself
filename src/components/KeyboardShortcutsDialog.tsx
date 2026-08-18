import { useEffect, useRef } from "react";

interface KeyboardShortcutsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const shortcuts = [
  ["?", "Open this shortcut guide"],
  ["Ctrl/Cmd + F", "Focus the quiz search"],
  ["↑ / ↓", "Move through quiz search results"],
  ["Enter", "Open the highlighted quiz search result"],
  ["Tab, Enter, Space", "Move between and choose quiz answers"],
  ["Esc", "Stop auto-scroll or close this guide"],
];

export function KeyboardShortcutsDialog({
  isOpen,
  onClose,
}: KeyboardShortcutsDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const previousFocus = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="shortcuts-overlay" onMouseDown={onClose}>
      <section
        aria-describedby="shortcuts-description"
        aria-labelledby="shortcuts-title"
        aria-modal="true"
        className="shortcuts-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
      >
        <div className="shortcuts-header">
          <div>
            <h2 id="shortcuts-title">Keyboard shortcuts</h2>
            <p id="shortcuts-description">
              Use these controls to browse quizzes and answer without a mouse.
            </p>
          </div>
          <button
            aria-label="Close keyboard shortcuts"
            className="top-bar-btn"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            ×
          </button>
        </div>
        <dl className="shortcuts-list">
          {shortcuts.map(([keys, description]) => (
            <div key={keys}>
              <dt>
                <kbd>{keys}</kbd>
              </dt>
              <dd>{description}</dd>
            </div>
          ))}
        </dl>
        <p className="shortcuts-note">
          Auto-scroll: middle-click in quiz content, then move the pointer up or
          down. Click or press Escape to stop.
        </p>
      </section>
    </div>
  );
}
