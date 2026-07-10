import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppFooter } from "@/components/layout/AppFooter";

export const metadata: Metadata = {
  title: "BrawlDraft — Ranked Draft Assistant (Unofficial)",
  description:
    "Unofficial Brawl Stars Ranked draft assistant with ban/pick recommendations. Not endorsed by Supercell.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-slate-950 text-slate-100 antialiased">
        <div className="flex-1">{children}</div>
        <AppFooter />
      </body>
    </html>
  );
}
