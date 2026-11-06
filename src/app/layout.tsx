import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next"
import { Heart } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { UpdateBanner } from "@/components/UpdateBanner";
import { getSavedTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import "./globals.css";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "Super Rare Tracker",
    description: "Stock alerts for Super Rare Games releases. Track a release and get a notification when its stock drops to the level you choose.",
};

const THEME_COLOR = { light: "#ffffff", dark: "#09090b" } as const;

export async function generateViewport(): Promise<Viewport> {
    const theme = await getSavedTheme();
    return {
        // Lets env(safe-area-inset-*) work, so the header and filter bar clear the notch.
        viewportFit: "cover",
        // The browser bar matches the page background: the saved theme, or the device's.
        // ThemeToggle updates it when the theme changes.
        themeColor: theme
            ? THEME_COLOR[theme]
            : [
                  { media: "(prefers-color-scheme: light)", color: THEME_COLOR.light },
                  { media: "(prefers-color-scheme: dark)", color: THEME_COLOR.dark },
              ],
    };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
    // A saved choice from the theme toggle; with none, the CSS follows the device.
    const theme = await getSavedTheme();

    return (
        <html
            lang="en-GB"
            className={cn(geistSans.variable, geistMono.variable, theme)}
        >
            <head>
                <meta
                    name="apple-mobile-web-app-title"
                    content="SuperRareTracker"
                />
            </head>
            <body className="flex min-h-full flex-col">
                <AppHeader savedTheme={theme} />
                {children}
                <UpdateBanner />
                <footer className="border-t pb-[env(safe-area-inset-bottom)]">
                    <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-x-6 gap-y-1 px-4 py-4 text-xs text-muted-foreground">
                        <p className="m-0">
                            Made with <Heart role="img" aria-label="love" className="inline size-3 fill-current align-[-1px] text-brand-foreground" /> by{" "}
                            <a href="https://pederjohnsen.com" target="_blank" rel="noopener" className="text-foreground underline underline-offset-2">Peder Johnsen</a>
                        </p>
                        <p className="m-0">Fan-made tracker, not affiliated with Super Rare Games.</p>
                    </div>
                </footer>
                <Analytics />
            </body>
        </html>
    );
}
