import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { API_BASE_URL, API_SECRET_TOKEN } from "../../../lib/api";

const googleLoginSchema = z.object({
  email: z.string().email(),
  google_id: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const body = (await request.json()) as unknown;
    const validation = googleLoginSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "Invalid input data" }, { status: 400 });
    }

    const response = await fetch(`${API_BASE_URL}/v1/oauth/google_login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: request.headers.get("cookie") || "",
      },
      body: JSON.stringify({
        email: validation.data.email,
        google_id: validation.data.google_id,
        token: API_SECRET_TOKEN,
      }),
    });

    if (!response.ok) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const errorData = (await response.json()) as { error?: string };
      return NextResponse.json({ error: errorData.error || "Google login failed" }, { status: response.status });
    }

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const data = (await response.json()) as unknown;
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: "Google login failed" }, { status: 500 });
  }
}
