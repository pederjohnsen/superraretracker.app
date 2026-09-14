"use client";

import { useEffect, useState } from "react";
import styles from "./UpdateBanner.module.css";

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
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="update-title">
      <section className={styles.modal}>
        <h2 id="update-title">Update available</h2>
        <p>A new version of SuperRareTracker is ready. Update now to continue.</p>
        <button type="button" onClick={() => window.location.reload()}>
          Update now
        </button>
      </section>
    </div>
  );
}
