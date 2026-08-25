import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

export function LoadingState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center" role="status" aria-live="polite">
      <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="surface-panel flex flex-col items-center gap-3 px-6 py-12 text-center">
      {icon ? <div className="text-muted-foreground">{icon}</div> : null}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}

export function ErrorState({ message, action }: { message?: string; action?: ReactNode }) {
  return (
    <div className="surface-panel flex flex-col items-center gap-3 px-6 py-10 text-center" role="alert">
      <h3 className="text-base font-semibold text-foreground">Something went wrong</h3>
      <p className="max-w-md text-sm text-muted-foreground">
        {message ?? "We couldn't complete that request. Please try again."}
      </p>
      {action}
    </div>
  );
}
