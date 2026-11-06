import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next"
import { UpdateBanner } from "@/components/UpdateBanner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getSavedTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import "./globals.css";
import Link from "next/link";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "SuperRareTracker",
    description: "A Super Rare Games stock Tracker",
};

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
            <body>
                <TooltipProvider>
                    {/* Temporary spot until the redesigned header (next PR) takes it. */}
                    <div className="fixed top-[calc(env(safe-area-inset-top)+0.75rem)] right-3 z-50">
                        <ThemeToggle saved={theme} />
                    </div>
                    {children}
                    <UpdateBanner />
                    <footer>
                        <p>Made with &hearts; by <Link href="https://pederjohnsen.com" target="_blank">Peder Johnsen</Link></p>
                    </footer>
                </TooltipProvider>
            </body>
            <Analytics />
        </html>
    );
}
