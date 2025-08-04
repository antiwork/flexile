import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { API_BASE_URL, API_SECRET_TOKEN } from "../../../lib/api";

const sendOtpSchema = z.object({
  email: z.string().email(),
  invitation_token: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const body = (await request.json()) as unknown;
    const validation = sendOtpSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "Invalid input data" }, { status: 400 });
    }

    const requestBody: Record<string, string> = {
      email: validation.data.email,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      token: API_SECRET_TOKEN!,
    };

    // Add invitation token if provided
    if (validation.data.invitation_token) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      requestBody.invitation_token = validation.data.invitation_token!;
    }

    const response = await fetch(`${API_BASE_URL}/v1/signup/send_otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const errorData = (await response.json()) as { error?: string };
      return NextResponse.json(
        { error: errorData.error || "Failed to send verification code" },
        { status: response.status },
      );
    }

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const data = (await response.json()) as unknown;
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: "Failed to send verification code" }, { status: 500 });
  }
}
