import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { API_BASE_URL } from "../../../lib/api";

const userDataSchema = z.object({
  jwt: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const body = (await request.json()) as unknown;
    const validation = userDataSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "JWT token is required" }, { status: 400 });
    }

    // Make request to backend to get full user data
    const cookies = request.headers.get("cookie") || "";

    const response = await fetch(`${API_BASE_URL}/internal/current_user_data`, {
      method: "GET",
      headers: {
        "x-flexile-auth": `Bearer ${validation.data.jwt}`,
        "Content-Type": "application/json",
        Cookie: cookies,
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch user data" }, { status: response.status });
    }

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const userData = (await response.json()) as unknown;
    return NextResponse.json(userData, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
