import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "SuperRareTracker",
        short_name: "SRT",
        description: "A Super Rare Games stock Tracker app",
        start_url: "/",
        display: "standalone",
        background_color: "#000000",
        theme_color: "#3b3333",
        icons: [
            {
                src: "/icon-192x192.png",
                sizes: "192x192",
                type: "image/png",
            },
            {
                src: "/icon-512x512.png",
                sizes: "512x512",
                type: "image/png",
            },
            // For Android launchers, which crop icons to their own shape. Full-bleed
            // background with the lettering inside the central safe zone, so Chrome
            // uses it instead of shrinking the square icon onto a white circle.
            {
                src: "/icon-maskable-192x192.png",
                sizes: "192x192",
                type: "image/png",
                purpose: "maskable",
            },
            {
                src: "/icon-maskable-512x512.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "maskable",
            },
        ],
    };
}
