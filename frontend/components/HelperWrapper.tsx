import { currentUser } from "@clerk/nextjs/server";
import { generateHelperAuth, HelperProvider } from "@helperai/react";
import React from "react";
import env from "@/env";

interface HelperWrapperProps {
  children: React.ReactNode;
}

export async function HelperWrapper({ children }: HelperWrapperProps) {
  if (!env.HELPER_WIDGET_HOST) return children;

  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress;
  const helperAuth =
    email && env.HELPER_HMAC_SECRET
      ? generateHelperAuth({
          email,
          hmacSecret: env.HELPER_HMAC_SECRET,
          mailboxSlug: "flexile",
        })
      : null;

  return (
    <HelperProvider host={env.HELPER_WIDGET_HOST} mailboxSlug="flexile" {...helperAuth}>
      {children}
    </HelperProvider>
  );
}
