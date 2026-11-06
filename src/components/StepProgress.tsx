import { cn } from "@/lib/utils";

/** The setup steps as short bars with labels. Done steps get a tick; the current one is bold. */
export function StepProgress({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol
      aria-label="Setup progress"
      className={cn("m-0 grid list-none gap-2 p-0", steps.length === 3 ? "grid-cols-3" : "grid-cols-2")}
    >
      {steps.map((label, index) => {
        const done = index < current;
        const isCurrent = index === current;
        return (
          <li key={label} aria-current={isCurrent ? "step" : undefined} className="flex flex-col gap-1.5">
            <div aria-hidden className={cn("h-1 rounded-full", done || isCurrent ? "bg-primary" : "bg-secondary")} />
            <span
              className={cn(
                "text-xs",
                done && "font-medium text-subtle-foreground",
                isCurrent && "font-semibold text-foreground",
                !done && !isCurrent && "font-medium text-muted-foreground",
              )}
            >
              {done ? <span aria-hidden>✓ </span> : `${index + 1}. `}
              {label}
              <span className="sr-only">{done ? ", completed" : isCurrent ? ", current step" : ""}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
