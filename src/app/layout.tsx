import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme";
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
  title: "Vibe Trade — Crypto Strategy Backtester",
  description:
    "Describe a trading strategy in plain English, backtest it on real crypto data, and see the results instantly.",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📈</text></svg>",
  },
  openGraph: {
    title: "Vibe Trade — Crypto Strategy Backtester",
    description:
      "Describe a trading strategy in plain English, backtest it on real crypto data, and see the results instantly.",
    type: "website",
    siteName: "Vibe Trade",
  },
  twitter: {
    card: "summary",
    title: "Vibe Trade — Crypto Strategy Backtester",
    description:
      "Describe a trading strategy in plain English, backtest it on real crypto data, and see the results instantly.",
  },
};

/** Inline script to apply persisted theme before React hydrates (prevents flash) */
const themeScript = `try{var t=localStorage.getItem('vt-theme');if(t&&['terminal','amber','cyan','copper'].includes(t))document.documentElement.setAttribute('data-theme',t)}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
