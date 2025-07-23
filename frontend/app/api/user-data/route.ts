import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const userDataSchema = z.object({
  jwt: z.string(),
});

const API_BASE_URL = process.env.NODE_ENV === "production" ? "https://api.flexile.com" : "http://api.flexile.dev";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = userDataSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "JWT token is required" }, { status: 400 });
    }

    // Make request to backend to get full user data
    const response = await fetch(`${API_BASE_URL}/internal/current_user_data`, {
      method: "GET",
      headers: {
        "x-flexile-auth": `Bearer ${validation.data.jwt}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch user data" }, { status: response.status });
    }

    const userData = await response.json();
    return NextResponse.json(userData, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
