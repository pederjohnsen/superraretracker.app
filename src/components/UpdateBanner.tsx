"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const CHECK_INTERVAL_MS = 60_000;
const currentVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? "development";

export function UpdateBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const checkForUpdate = async () => {
      try {
        const response = await fetch(`/api/version?current=${encodeURIComponent(currentVersion)}`, {
          cache: "no-store",
        });
        if (!response.ok) return;

        const data: { version?: string } = await response.json();
        if (!cancelled && data.version && data.version !== currentVersion) {
          setUpdateAvailable(true);
        }
      } catch {
        // A failed version check should not interrupt normal app use.
      }
    };

    checkForUpdate();
    const interval = window.setInterval(checkForUpdate, CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!updateAvailable) return;

    const scrollY = window.scrollY;
    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyStyles = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    };

    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";

    return () => {
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyStyles.overflow;
      body.style.position = previousBodyStyles.position;
      body.style.top = previousBodyStyles.top;
      body.style.width = previousBodyStyles.width;
      window.scrollTo(0, scrollY);
    };
  }, [updateAvailable]);

  if (!updateAvailable) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-title"
      aria-describedby="update-body"
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-6"
    >
      <section className="flex w-full max-w-sm flex-col items-center gap-3 rounded-xl border bg-card p-6 text-center text-card-foreground shadow-lg">
        <h2 id="update-title" className="m-0 text-lg font-semibold">
          Update available
        </h2>
        <p id="update-body" className="m-0 text-sm text-muted-foreground">
          A new version of Super Rare Tracker is ready. Update now to carry on.
        </p>
        {/* The only way forward, so it takes focus. */}
        <Button autoFocus className="mt-2 w-full px-4" onClick={() => window.location.reload()}>
          <RefreshCw aria-hidden />
          Update now
        </Button>
      </section>
    </div>
  );
}
