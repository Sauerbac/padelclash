import type { Metadata } from "next";
import { Archivo_Black, Space_Grotesk, Space_Mono } from "next/font/google";
import "./globals.css";
import { TabBar } from "./_shell/TabBar";

// The DS's three voices (design-system-binding.md §1). Each exposes a CSS
// variable the @theme block binds to a font token (--font-display/body/mono).
const archivo = Archivo_Black({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-archivo",
  display: "swap",
});

const grotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-grotesk",
  display: "swap",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PadelClash",
  description: "Padel ratings, leagues, and leaderboards.",
};

// English-first, i18n-ready (ADR-0011).
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${grotesk.variable} ${spaceMono.variable}`}
    >
      <body>
        {children}
        <TabBar />
      </body>
    </html>
  );
}
