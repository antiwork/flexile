import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { API_BASE_URL, API_SECRET_TOKEN } from "../../../lib/api";

const verifySignupSchema = z.object({
  email: z.string().email(),
  otp_code: z.string().length(6),
});

export async function POST(request: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const body = (await request.json()) as unknown;
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
        token: API_SECRET_TOKEN,
      }),
    });

    if (!response.ok) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const errorData = (await response.json()) as { error?: string };
      return NextResponse.json({ error: errorData.error || "Signup verification failed" }, { status: response.status });
    }

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const data = (await response.json()) as unknown;
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: "Signup verification failed" }, { status: 500 });
  }
}
