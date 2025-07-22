import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const API_BASE_URL = process.env.NODE_ENV === "production" ? "https://api.flexile.com" : "https://api.flexile.dev";
const API_SECRET_TOKEN = process.env.API_SECRET_TOKEN;

if (!API_SECRET_TOKEN) {
  throw new Error("API_SECRET_TOKEN environment variable is required");
}

const sendOtpSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = sendOtpSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    const response = await fetch(`${API_BASE_URL}/v1/signup/send_otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: validation.data.email,
        token: API_SECRET_TOKEN,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.error || "Failed to send OTP" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to send OTP" },
      { status: 500 }
    );
  }
}