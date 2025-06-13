import { NextRequest, NextResponse } from "next/server";
import { generateHelperAuth } from "@helperai/react";

export async function POST(request: NextRequest) {
  try {
    const requestData = await request.json();

    if (!requestData || typeof requestData !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const email = requestData.email;
    const name = requestData.name;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    if (!process.env.HELPER_HMAC_SECRET) {
      return NextResponse.json({ mailbox_slug: "flexile" });
    }

    const helperAuth = generateHelperAuth({
      email,
      hmacSecret: process.env.HELPER_HMAC_SECRET,
      mailboxSlug: "flexile",
    });

    const response = {
      ...helperAuth,
      customer_metadata: {
        name: name || "Unknown User",
        value: null,
        links: {
          Profile: "/settings",
          Dashboard: "/dashboard",
        },
      },
    };

    return NextResponse.json(response);
  } catch (_error) {
    return NextResponse.json({ error: "Failed to generate auth" }, { status: 500 });
  }
}
