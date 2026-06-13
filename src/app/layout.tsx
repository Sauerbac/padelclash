import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PadelClash",
  description: "Padel ratings, leagues, and leaderboards.",
};

// English-first, i18n-ready (ADR-0011).
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
