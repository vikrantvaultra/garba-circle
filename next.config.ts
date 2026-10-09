import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        // The garba map is the front door: a shared link opens straight onto
        // it, signed in or not. Temporary (307), so browsers don't cache it
        // forever if the home page changes. Query strings carry across, so
        // "/?city=surat" lands on Surat's garbas.
        source: "/",
        destination: "/garba",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        // The notification worker must never be served stale, or a fix to it
        // would take a day to reach phones.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
