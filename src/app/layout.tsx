import type { Metadata, Viewport } from "next";
import { Baloo_2, Outfit } from "next/font/google";
import { Ambience } from "@/components/Ambience";
import { DemoBanner } from "@/components/DemoBanner";
import { ToastProvider } from "@/components/Toast";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";
import "./globals.css";

// Baloo 2 carries Devanagari as well as Latin, so Hindi and Marathi names
// render in the same festive face as everything else.
const baloo = Baloo_2({
  subsets: ["latin", "devanagari"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-baloo",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${APP_NAME} — ${APP_TAGLINE}`,
  description:
    "Spin the reel, find your Garba partner for Navratri, and chat safely inside Garba Circle.",
  applicationName: APP_NAME,
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "black-translucent" },
  openGraph: {
    title: `${APP_NAME} — ${APP_TAGLINE}`,
    description: "Nau raat, ek circle. Find your Garba partner this Navratri.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#120520",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${baloo.variable} ${outfit.variable}`}>
      <body className="antialiased">
        <Ambience />
        <ToastProvider>
          <DemoBanner />
          <div className="relative z-10">{children}</div>
        </ToastProvider>
      </body>
    </html>
  );
}
