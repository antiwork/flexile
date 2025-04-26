import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { TooltipProvider } from "@/components/Tooltip";
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
  description: "Equity for everyone",
  icons: [
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
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${abcWhyte.className} h-screen antialiased accent-blue-600`}>
        <ClerkProvider
          dynamic
          signInFallbackRedirectUrl="/dashboard"
          signUpFallbackRedirectUrl="/dashboard"
          appearance={{
            variables: { fontSize: "inherit" },
            layout: { socialButtonsPlacement: "bottom" },
            elements: {
              rootBox: "w-full!",
              cardBox: "w-full! shadow-none! border! border-muted!",
              headerTitle: "text-2xl! text-black!",
              headerSubtitle: "text-gray-500!",
              form: "gap-4!",
              formFieldInput: "border! border-muted! shadow-none! focus:outline-blue-50! focus:outline-offset-0!",
              formButtonPrimary:
                "rounded-full bg-black! text-white! hover:bg-blue-600! hover:border-blue-600! border! border-muted! font-normal! [&::after]:bg-none! shadow-none! focus:ring-0! focus:outline! focus:outline-2! focus:outline-blue-50! focus:outline-offset-0!",
              dividerText: "text-gray-500!",
              dividerLine: "bg-black!",
              socialButtonsBlockButton:
                "rounded-full! text-black! hover:border-blue-600! hover:text-blue-600! border! border-muted! shadow-none! bg-none! focus:ring-0! focus:outline! focus:outline-2! focus:outline-blue-50! focus:outline-offset-0!",
              socialButtonsBlockButtonText: "font-normal!",
              buttonArrowIcon: "hidden!",
              footer: "bg-none! bg-gray-50! border-t! border-muted! mt-0! pt-0!",
              card: "rounded-none! shadow-none!",
              footerActionLink: "hover:text-blue-600!",
              footerActionText: "text-gray-600!",
              formFieldCheckboxInput:
                "h-4! w-4! border! border-muted! rounded-xs bg-white! checked:bg-blue-600! checked:border-blue-600! focus:ring-2! focus:ring-blue-50!",
            },
          }}
        >
          <TRPCProvider>
            <NuqsAdapter>
              <TooltipProvider delayDuration={0}>{children}</TooltipProvider>
            </NuqsAdapter>
          </TRPCProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
