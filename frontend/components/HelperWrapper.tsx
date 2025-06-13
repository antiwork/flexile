"use client";

import React, { useEffect, useState } from "react";
import { HelperProvider } from "@helperai/react";
import { useCurrentUser } from "@/global";

interface HelperWrapperProps {
  children: React.ReactNode;
}

export function HelperWrapper({ children }: HelperWrapperProps) {
  const user = useCurrentUser();
  const [helperAuth, setHelperAuth] = useState<Record<string, unknown>>({ mailbox_slug: "flexile" });

  useEffect(() => {
    if (user.email) {
      fetch("/api/helper-auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: user.email,
          name: user.name,
        }),
      })
        .then((res) => res.json())
        .then((auth: Record<string, unknown>) => setHelperAuth(auth))
        .catch(() => {
          setHelperAuth({ mailbox_slug: "flexile" });
        });
    }
  }, [user]);

  return (
    <HelperProvider host="https://help.gumroad.com" mailbox_slug="flexile" {...helperAuth}>
      {children}
    </HelperProvider>
  );
}
