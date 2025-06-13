import { generateHelperAuth } from "@helperai/react";

export async function createHelperAuth(email: string, name?: string | null, companyName?: string | null) {
  if (!process.env.HELPER_HMAC_SECRET) {
    console.warn("HELPER_HMAC_SECRET not configured");
    return { mailbox_slug: "flexile" };
  }

  try {
    const helperAuth = generateHelperAuth({
      email,
      hmacSecret: process.env.HELPER_HMAC_SECRET,
      mailboxSlug: "flexile"
    });

    return {
      ...helperAuth,
      customer_metadata: {
        name: name || "Unknown User",
        value: null,
        links: {
          "Profile": "/settings"
        }
      }
    };
  } catch (error) {
    console.error("Failed to generate Helper auth:", error);
    return { mailbox_slug: "flexile" };
  }
}
