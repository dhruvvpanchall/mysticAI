import type { Metadata, Viewport } from "next";
import { Inter, Cormorant_Garamond, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MysticAI",
  description:
    "Your spiritual AI companion. Seek wisdom inspired by the Bhagavad Gita, Ramayana, and Upanishads through advanced intelligence.",
  keywords: [
    "MysticAI",
    "spiritual AI",
    "Bhagavad Gita AI",
    "wisdom assistant",
    "Upanishads",
  ],
  authors: [{ name: "MysticAI" }],
  openGraph: {
    title: "MysticAI",
    description: "Ask. Reflect. Evolve.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#05030d",
  width: "device-width",
  initialScale: 1,
  // viewportFit=cover lets us use env(safe-area-inset-*) on notched iPhones
  // so the composer doesn't sit behind the home indicator.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${cormorant.variable} ${jetbrains.variable} dark`}
      suppressHydrationWarning
    >
      <body className="min-h-[100dvh] bg-void text-white/90 antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
