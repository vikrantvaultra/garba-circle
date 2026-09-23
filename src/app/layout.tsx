import type { Metadata, Viewport } from "next";
import { Hind_Vadodara, Rozha_One } from "next/font/google";
import { Ambience } from "@/components/Ambience";
import { DemoBanner } from "@/components/DemoBanner";
import { MessageNotifier } from "@/components/MessageNotifier";
import { ToastProvider } from "@/components/Toast";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";
import "./globals.css";

// Rozha One for headlines and names; it carries Devanagari as well as Latin,
// so Hindi and Marathi names render in the same face. Hind Vadodara for body
// text, which covers Gujarati.
const rozha = Rozha_One({
  subsets: ["latin", "devanagari"],
  weight: "400",
  variable: "--font-rozha",
  display: "swap",
});

const hind = Hind_Vadodara({
  subsets: ["latin", "gujarati"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hind",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${APP_NAME} — ${APP_TAGLINE}`,
  description:
    "Spin the circle, find your Garba partner for Navratri, and chat safely inside Garba Circle.",
  applicationName: APP_NAME,
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "black-translucent" },
  openGraph: {
    title: `${APP_NAME} — ${APP_TAGLINE}`,
    description: "Nau raat, ek circle. Find your Garba partner this Navratri.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#140a33",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${rozha.variable} ${hind.variable}`}>
      <body className="antialiased">
        <Ambience />
        <ToastProvider>
          <DemoBanner />
          <div className="relative z-10">{children}</div>
          <MessageNotifier />
        </ToastProvider>
      </body>
    </html>
  );
}
