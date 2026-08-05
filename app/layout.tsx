import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "AppFoundry — AI App Making Platform",
    template: "%s | AppFoundry",
  },
  description:
    "Build production-ready apps with natural language. Own your code. Monetize what you ship.",
  authors: [{ name: "AppFoundry", url: "https://appfoundry.ai" }],
  keywords: [
    "ai",
    "app builder",
    "no-code",
    "low-code",
    "developer tools",
    "generative ai",
  ],
  openGraph: {
    title: "AppFoundry — AI App Making Platform",
    description:
      "Build production-ready apps with natural language. Own your code. Monetize what you ship.",
    url: "https://appfoundry.ai/",
    siteName: "AppFoundry",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AppFoundry — AI App Making Platform",
    description:
      "Build production-ready apps with natural language. Own your code. Monetize what you ship.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
    other: [
      {
        rel: "manifest",
        url: "/site.webmanifest",
      },
    ],
  },
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen antialiased`}>
        {/* Accessibility: skip link shown on keyboard focus */}
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>

        <main id="main-content">{children}</main>

        <noscript>
          JavaScript is required to run this app. Please enable JavaScript in your
          browser settings.
        </noscript>

        {/* Minimal styles for the skip link so it is hidden visually but available to keyboard users */}
        <style>{`
          .skip-link{position:absolute;left:-999px;top:auto;width:1px;height:1px;overflow:hidden}
          .skip-link:focus{position:fixed;left:1rem;top:1rem;width:auto;height:auto;padding:.5rem .75rem;background:#111;color:#fff;border-radius:6px;z-index:9999}
        `}</style>
      </body>
    </html>
  );
}
