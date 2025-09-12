import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import env from "@/env";
import { authOptions } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user.jwt) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || !("email" in body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const { email } = body as { email: string };

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const backendUrl = request.headers.get("origin") || `${env.PROTOCOL}://${env.DOMAIN}`;

    const response = await fetch(`${backendUrl}/internal/admin/impersonation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-flexile-auth": `Bearer ${session.user.jwt}`,
      },
      body: JSON.stringify({ email }),
    });

    const data: unknown = await response.json();
    if (!data || typeof data !== "object") {
      return NextResponse.json({ error: "Invalid response from server" }, { status: 500 });
    }
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const responseData = data as { error?: string; impersonation_jwt?: string; user?: unknown };

    if (!response.ok) {
      return NextResponse.json(
        { error: responseData.error ?? "Failed to impersonate user" },
        { status: response.status },
      );
    }

    return NextResponse.json(responseData);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Impersonation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
