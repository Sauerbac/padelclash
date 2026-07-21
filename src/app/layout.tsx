import type { Metadata, Viewport } from "next";
import { Anton, Barlow_Condensed, IBM_Plex_Mono } from "next/font/google";
import { OfflineSync } from "@/components/offline-sync";
import { SwRegister } from "@/components/sw-register";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // No auth work here on purpose: binding validity is a database question now
  // (a cookie's presence proves nothing), and the root layout must still render
  // with Postgres down. Pages resolve the viewer themselves.
  return (
    <html
      lang="en"
      className={`${anton.variable} ${barlow.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SwRegister />
        <OfflineSync />
        {children}
      </body>
    </html>
  );
}
