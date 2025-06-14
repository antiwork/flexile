import React from "react";
import { generateHelperAuth, HelperProvider } from "@helperai/react";
import { currentUser } from "@clerk/nextjs/server";
import env from "@/env";

interface HelperWrapperProps {
  children: React.ReactNode;
}

export async function HelperWrapper({ children }: HelperWrapperProps) {
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
    <HelperProvider host="https://help.gumroad.com" {...helperAuth}>
      {children}
    </HelperProvider>
  );
}
