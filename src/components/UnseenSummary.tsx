"use client";

import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type UnseenSummaryItem = {
  releaseKey: string;
  title: string;
  /** "SRG#163 · Switch", shown from 640px. */
  detail: string;
  /** "dropped to 24%, matching your alert" */
  text: string;
  /** "20 min ago" */
  when: string;
};

type UnseenSummaryProps = {
  items: UnseenSummaryItem[];
  onJump: (releaseKey: string) => void;
  onDismiss: () => void;
};

/**
 * "2 new alerts since your last visit": the alerts this device was sent but
 * hadn't seen, one line per release, between the heading and the filter bar.
 * Each title jumps to its card. Dismiss hides the strip for this visit.
 */
export function UnseenSummary({ items, onJump, onDismiss }: UnseenSummaryProps) {
  if (items.length === 0) return null;
  const title = items.length === 1 ? "1 new alert since your last visit" : `${items.length} new alerts since your last visit`;

  return (
    <section
      aria-labelledby="unseen-heading"
      className="flex items-start gap-4 rounded-md border border-primary/40 bg-primary/10 pt-1 pr-1 pb-3 pl-3 sm:py-2 sm:pr-2 sm:pl-4"
    >
      <span
        aria-hidden
        className="mt-2.5 hidden size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-brand-foreground sm:inline-flex"
      >
        <BellRing className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:py-1.5">
        <div className="flex items-center justify-between gap-2">
          <h2 id="unseen-heading" className="m-0 pt-2 text-sm font-semibold sm:pt-0">
            {title}
          </h2>
          <DismissButton onClick={onDismiss} className="sm:hidden" />
        </div>
        <ul className="m-0 flex list-none flex-col p-0 pr-2 sm:pr-0">
          {items.map((item) => (
            <li key={item.releaseKey} className="flex items-baseline gap-2 py-1 text-sm sm:py-0.5">
              <span aria-hidden className="size-1.5 shrink-0 -translate-y-0.5 rounded-full bg-primary" />
              <span className="min-w-0 flex-1 sm:flex-none">
                <button
                  type="button"
                  onClick={() => onJump(item.releaseKey)}
                  className="cursor-pointer border-0 bg-transparent p-0 text-left text-sm font-semibold text-foreground underline underline-offset-2 hover:text-brand-foreground"
                >
                  {item.title}
                </button>{" "}
                <span className="hidden text-muted-foreground sm:inline">({item.detail})</span> {item.text}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                <span aria-hidden className="hidden sm:inline">
                  ·{" "}
                </span>
                {item.when}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <DismissButton onClick={onDismiss} className="hidden sm:inline-flex" />
    </section>
  );
}

function DismissButton({ onClick, className }: { onClick: () => void; className: string }) {
  return (
    <Button variant="ghost" className={cn("h-11 shrink-0 px-3 sm:h-9", className)} onClick={onClick} aria-label="Dismiss new alerts">
      Dismiss
    </Button>
  );
}
