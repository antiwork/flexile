import type { Metadata } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "next-themes";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "sonner";
import "./globals.css";
import { TRPCProvider } from "@/trpc/client";

const abcWhyte = localFont({
  src: [
    { path: "./ABCWhyte-Regular.woff", weight: "400" },
    { path: "./ABCWhyte-Medium.woff", weight: "500" },
    { path: "./ABCWhyte-Bold.woff", weight: "600" },
  ],
  fallback: ["sans-serif"],
});

export const metadata: Metadata = {
  title: "Flexile",
  description: "Contractor payments",
  icons: {
    icon: [
      {
        rel: "icon",
        type: "image/png",
        url: "/favicon-light.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        rel: "icon",
        type: "image/png",
        url: "/favicon-dark.png",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    apple: [{ url: "/apple-icon.png" }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${abcWhyte.className} h-screen antialiased accent-blue-600`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TRPCProvider>
            <NuqsAdapter>{children}</NuqsAdapter>
          </TRPCProvider>
          <Toaster
            position="top-center"
            toastOptions={{
              classNames: {
                toast: "bg-background border-border shadow-lg",
                title: "text-foreground text-sm font-normal",
                success: "text-green-600",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
