/* Hallmark · genre: playful · theme: Hum · design-system: design.md · designed-as-app */
import type { Metadata } from "next";
import "./globals.css";
import { MaintenanceWrapper } from "./providers/MaintenanceWrapper";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import LogCapture from "./providers/LogCapture";
import { VisitorTracker } from "./_components/VisitorTracker";

export const metadata: Metadata = {
  title: "World of Physics - The exam before the exam.",
  description:
    "A faithful reproduction of the JEE and NEET computer-based test portals.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <LogCapture />
        <VisitorTracker />
        <MaintenanceWrapper>{children}</MaintenanceWrapper>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
