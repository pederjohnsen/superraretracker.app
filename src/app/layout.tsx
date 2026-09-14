import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next"
import { UpdateBanner } from "@/components/UpdateBanner";
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
    title: "SuperRareTracker",
    description: "A Super Rare Games stock Tracker",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
    return (
        <html
            lang="en"
            className={`${geistSans.variable} ${geistMono.variable}`}
        >
            <head>
                <meta
                    name="apple-mobile-web-app-title"
                    content="SuperRareTracker"
                />
            </head>
            <body>
                {children}
                <UpdateBanner />
            </body>
            <Analytics />
        </html>
    );
}
