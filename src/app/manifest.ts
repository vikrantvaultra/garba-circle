import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/constants";

/**
 * Makes the app installable. On iPhone this is also what makes message
 * notifications possible at all: iOS only gives web push to a site added to
 * the Home Screen and opened from there.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: "Find your garba partner this Navratri, and chat safely.",
    start_url: "/garba",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0c0522",
    theme_color: "#140a33",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
