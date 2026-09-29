import { clsx } from "clsx";

export type StatusIconKind =
  | "success"
  | "error"
  | "folder"
  | "quiz"
  | "loading";

export function StatusIcon({
  kind,
  className,
}: {
  kind: StatusIconKind;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={clsx("status-icon", `status-icon--${kind}`, className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {kind === "success" && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12 2.5 2.5L16 9" />
        </>
      )}
      {kind === "error" && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="m9 9 6 6M15 9l-6 6" />
        </>
      )}
      {kind === "folder" && (
        <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z" />
      )}
      {kind === "quiz" && (
        <>
          <path d="M5 4h14v16H5z" />
          <path d="M9 8h6M9 12h6M9 16h3" />
        </>
      )}
      {kind === "loading" && (
        <>
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <path d="M21 3v6h-6" />
        </>
      )}
    </svg>
  );
}
