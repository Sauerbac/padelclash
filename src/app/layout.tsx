import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { BindingRecovery } from "@/components/binding-recovery";
import { hasPlayerBinding } from "@/services/auth/binding";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PadelClash",
  description: "Padel match tracker for the circle",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <BindingRecovery isBound={isBound} />
        {children}
      </body>
    </html>
  );
}
