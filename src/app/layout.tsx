import type { Metadata, Viewport } from "next";
import { Anton, Barlow_Condensed, IBM_Plex_Mono } from "next/font/google";
import { OfflineLifecycle } from "@/components/offline-lifecycle";
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
  robots: { index: false, follow: false },
  appleWebApp: {
    capable: true,
    title: "PadelClash",
    statusBarStyle: "black",
  },
};

export const viewport: Viewport = {
  themeColor: "#16110d",
  viewportFit: "cover",
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
      <body className="flex h-full flex-col overflow-hidden">
        <SwRegister />
        <OfflineLifecycle />
        {/* The app's only scroller. See globals.css: iOS won't let us hide the
            document scroll indicator, but it honours the CSS on this one. */}
        <div
          id="scroll-root"
          className="flex min-h-0 flex-1 flex-col overflow-y-auto [-webkit-overflow-scrolling:touch]"
        >
          {children}
        </div>
      </body>
    </html>
  );
}
