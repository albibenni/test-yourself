import { clsx } from "clsx";
import type { ReactNode } from "react";
import { StatusIcon, type StatusIconKind } from "./StatusIcon";

export function StatusView({
  kind,
  title,
  children,
  action,
  compact = false,
}: {
  kind: StatusIconKind;
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={clsx("status-view", compact && "status-view--compact")}>
      <StatusIcon kind={kind} className="status-view-icon" />
      {title && <h2 className="status-view-title">{title}</h2>}
      <div className="status-view-message">{children}</div>
      {action && <div className="status-view-action">{action}</div>}
    </div>
  );
}
