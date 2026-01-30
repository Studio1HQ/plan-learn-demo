import type { Metadata } from "next";
import { Geist, Geist_Mono, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({subsets:['latin'],variable:'--font-sans'});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "AI Finance Assistant Demo",
    template: "%s · Memori Demo",
  },
  description:
    "A demo AI finance assistant built by the Memori team to showcase long-term memory, targeted recall, and real-time AI workflows in production.",
  applicationName: "Memori Finance Assistant Demo",
  keywords: [
    "AI finance assistant",
    "Memori demo",
    "AI memory",
    "long-term memory",
    "context-aware AI",
    "LLM memory",
    "financial insights",
    "streaming AI chat",
  ],
  authors: [{ name: "Memori Labs" }],
  creator: "Memori Labs",
  publisher: "GibsonAI, Inc. dba Memori Labs",

  openGraph: {
    title: "AI Finance Assistant Demo · Built with Memori",
    description:
      "A reference finance assistant demonstrating how Memori enables persistent, explainable memory for AI agents across sessions.",
    type: "website",
    siteName: "Memori Demos",
  },

  twitter: {
    card: "summary_large_image",
    title: "AI Finance Assistant Demo · Built with Memori",
    description:
      "See how Memori powers long-term memory and targeted recall in a real-world AI finance assistant demo.",
  },

  category: "Technology",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${jetbrainsMono.variable} dark`}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
