import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { TRPCProvider, UserDataProvider } from "@/trpc/client";

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
  description: "Contractor payments as easy as 1-2-3",
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
    <html lang="en">
      <body className={`${abcWhyte.className} h-screen antialiased accent-blue-600`}>
        <TRPCProvider>
          <UserDataProvider>
            <NuqsAdapter>{children}</NuqsAdapter>
          </UserDataProvider>
        </TRPCProvider>
      </body>
    </html>
  );
}
