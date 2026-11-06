"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Theme } from "@/lib/theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function themeFromPage(): Theme {
    const classes = document.documentElement.classList;
    if (classes.contains("dark")) return "dark";
    if (classes.contains("light")) return "light";
    return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

function hasSavedTheme() {
    return document.cookie.split("; ").some((c) => c.startsWith("theme="));
}

/**
 * Switches between light and dark. Follows the device until tapped, then
 * saves the choice in a `theme` cookie that the root layout reads on every
 * request, so the right theme is there on first paint.
 */
export function ThemeToggle({ saved }: { saved?: Theme }) {
    // With a saved theme the server already knows it; otherwise it's read on mount.
    const [theme, setTheme] = useState<Theme | undefined>(saved);

    useEffect(() => {
        // Sync with the class and media query the server can't see.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTheme(themeFromPage());
        if (saved) return;

        // No saved choice yet: keep following the device.
        const query = window.matchMedia(DARK_QUERY);
        const onChange = () => {
            if (!hasSavedTheme()) setTheme(themeFromPage());
        };
        query.addEventListener("change", onChange);
        return () => query.removeEventListener("change", onChange);
    }, [saved]);

    const next: Theme = theme === "dark" ? "light" : "dark";
    const label = `Switch to ${next} theme`;

    function toggle() {
        const root = document.documentElement;
        root.classList.remove("light", "dark");
        root.classList.add(next);
        document.cookie = `theme=${next}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
        setTheme(next);
    }

    return (
        <Button variant="ghost" size="icon" onClick={toggle} aria-label={label} title={label}>
            {theme === "dark" ? <Moon aria-hidden /> : theme === "light" ? <Sun aria-hidden /> : <span className="size-4" />}
        </Button>
    );
}
