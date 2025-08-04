import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendOtpEmail } from "@/lib/auth";

const sendOtpSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const body = (await request.json()) as unknown;
    const validation = sendOtpSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    const result = await sendOtpEmail(validation.data.email);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: "Failed to send verification code" }, { status: 500 });
  }
}
