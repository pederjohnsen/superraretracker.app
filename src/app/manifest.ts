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
        ],
    };
}
