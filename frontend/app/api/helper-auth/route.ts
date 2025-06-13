import { NextRequest, NextResponse } from "next/server";
import { generateHelperAuth } from "@helperai/react";

export async function POST(request: NextRequest) {
  try {
    const { email, name } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    if (!process.env.HELPER_HMAC_SECRET) {
      console.warn("HELPER_HMAC_SECRET not configured");
      return NextResponse.json({ mailbox_slug: "flexile" });
    }

    const helperAuth = generateHelperAuth({
      email,
      hmacSecret: process.env.HELPER_HMAC_SECRET,
      mailboxSlug: "flexile"
    });

    const response = {
      ...helperAuth,
      customer_metadata: {
        name: name || "Unknown User",
        value: null,
        links: {
          "Profile": "/settings",
          "Dashboard": "/dashboard"
        }
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to generate Helper auth:", error);
    return NextResponse.json({ error: "Failed to generate auth" }, { status: 500 });
  }
}
