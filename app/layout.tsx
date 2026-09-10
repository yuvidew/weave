import { ClerkProvider } from '@clerk/nextjs';
import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import RoolLayoutProvider from '@/components/providers/root-layout-provider';

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Weave — Build & Connect Your Own AI Agents",
  description: "Weave lets you create custom AI agents and connect them directly to the tools you already use — Notion, Gmail, Calendar, and more — so your agents can actually get work done, not just chat about it.",
};


/**
 * @component RootLayout
 * @description App-wide root layout — wraps every page with Clerk auth, the user-detail provider, and the theme provider.
 */
const RootLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => {

  return (
    <ClerkProvider>
      <html lang="en" className={inter.variable} suppressHydrationWarning>
        <body>
          <RoolLayoutProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              {children}
            </ThemeProvider>
          </RoolLayoutProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}

export default RootLayout;
