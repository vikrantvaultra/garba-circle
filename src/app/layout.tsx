import type { Metadata, Viewport } from "next";
import { Hind_Vadodara, Nunito } from "next/font/google";
import { Ambience } from "@/components/Ambience";
import { DemoBanner } from "@/components/DemoBanner";
import { MessageNotifier } from "@/components/MessageNotifier";
import { ToastProvider } from "@/components/Toast";
import { APP_NAME, APP_TAGLINE, FULL_NAME } from "@/lib/constants";
import "./globals.css";

// Nunito is Havmor's own typeface: Black for headlines, the lighter weights
// for everything else. Hind Vadodara sits behind it for Gujarati (ગરબા), which
// Nunito doesn't carry; Hindi and Marathi names fall through to the system.
const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-nunito",
  display: "swap",
});

const hind = Hind_Vadodara({
  subsets: ["gujarati"],
  weight: ["500", "700"],
  variable: "--font-hind",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${FULL_NAME} — ${APP_TAGLINE}`,
  description:
    "Havmor Garba Circle: spin the circle, find your garba partner for Navratri, and chat safely.",
  applicationName: FULL_NAME,
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "black-translucent" },
  openGraph: {
    title: `${FULL_NAME} — ${APP_TAGLINE}`,
    description: "Nau raat, ek circle, and more scoops of sweetness. Find your garba partner this Navratri.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#d3002b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${nunito.variable} ${hind.variable}`}>
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
