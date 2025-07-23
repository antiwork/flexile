import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const API_BASE_URL = process.env.NODE_ENV === "production" ? "https://api.flexile.com" : "https://api.flexile.dev";
const API_SECRET_TOKEN = process.env.API_SECRET_TOKEN;

if (!API_SECRET_TOKEN) {
  throw new Error("API_SECRET_TOKEN environment variable is required");
}

const verifySignupSchema = z.object({
  email: z.string().email(),
  otp_code: z.string().length(6),
  temp_user_id: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = verifySignupSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "Invalid input data" }, { status: 400 });
    }

    const response = await fetch(`${API_BASE_URL}/v1/signup/verify_and_create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: request.headers.get("cookie") || "",
      },
      body: JSON.stringify({
        email: validation.data.email,
        otp_code: validation.data.otp_code,
        temp_user_id: validation.data.temp_user_id,
        token: API_SECRET_TOKEN,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json({ error: errorData.error || "Signup verification failed" }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: "Signup verification failed" }, { status: 500 });
  }
}
