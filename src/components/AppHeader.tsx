"use client";

import Image from "next/image";
import { Bell } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useNotificationPermission } from "@/hooks/useNotificationPermission";
import type { Theme } from "@/lib/theme";

/**
 * Logo and name on the left; theme toggle and the "Alerts on" status on the
 * right. Not sticky: the FilterBar below it is what stays pinned.
 */
export function AppHeader({ savedTheme }: { savedTheme?: Theme }) {
  const { permission } = useNotificationPermission();

  return (
    <header className="border-b pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          {/* The name follows, so the logo is decorative. */}
          <Image src="/logo.svg" alt="" width={32} height={32} priority className="size-8 shrink-0 rounded-md" />
          <p className="m-0 truncate text-base font-semibold tracking-tight">Super Rare Tracker</p>
          <span className="hidden text-sm text-muted-foreground md:inline">· Stock alerts for Super Rare Games</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle saved={savedTheme} />
          {permission === "granted" && (
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium">
              <Bell aria-hidden className="size-3.5 text-success" />
              Alerts on
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
