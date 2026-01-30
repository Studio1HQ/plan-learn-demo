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
    default: "Plan & Learn Agent Demo",
    template: "%s · Memori Demo",
  },
  description:
    "A self-learning research agent that plans tasks step-by-step, executes them, and learns from successful runs. Built with Memori for persistent pattern memory.",
  applicationName: "Plan & Learn Agent Demo",
  keywords: [
    "Plan & Learn agent",
    "self-learning AI",
    "Memori demo",
    "AI memory",
    "long-term memory",
    "pattern learning",
    "task planning",
    "LLM memory",
    "research agent",
    "streaming AI chat",
  ],
  authors: [{ name: "Memori Labs" }],
  creator: "Memori Labs",
  publisher: "GibsonAI, Inc. dba Memori Labs",

  openGraph: {
    title: "Plan & Learn Agent Demo · Built with Memori",
    description:
      "A self-learning agent that breaks down tasks, executes them, and stores successful patterns for future use. No fine-tuning needed.",
    type: "website",
    siteName: "Memori Demos",
  },

  twitter: {
    card: "summary_large_image",
    title: "Plan & Learn Agent Demo · Built with Memori",
    description:
      "See how Memori powers a self-learning research agent that gets smarter with every task completed.",
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
