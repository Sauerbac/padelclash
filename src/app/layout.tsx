import type { Metadata, Viewport } from "next";
import { Anton, Barlow_Condensed, IBM_Plex_Mono } from "next/font/google";
import { BindingRecovery } from "@/components/binding-recovery";
import { OfflineSync } from "@/components/offline-sync";
import { SwRegister } from "@/components/sw-register";
import { hasPlayerBinding } from "@/services/auth/binding";
import "./globals.css";

const anton = Anton({
  weight: "400",
  variable: "--font-anton",
  subsets: ["latin"],
});

const barlow = Barlow_Condensed({
  weight: ["400", "500", "600", "700"],
  variable: "--font-barlow",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PadelClash",
  description: "Padel match tracker for the circle",
  appleWebApp: {
    capable: true,
    title: "PadelClash",
    statusBarStyle: "black",
  },
};

export const viewport: Viewport = {
  themeColor: "#16110d",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Cookie presence only — no DB in the root layout, so every route renders
  // even with Postgres down. Pages that need the player row query themselves.
  const isBound = await hasPlayerBinding();
  return (
    <html
      lang="en"
      className={`${anton.variable} ${barlow.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SwRegister />
        <OfflineSync />
        <BindingRecovery isBound={isBound} />
        {children}
      </body>
    </html>
  );
}
