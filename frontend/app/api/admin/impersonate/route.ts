import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import env from "@/env";
import { authOptions } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.jwt) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Construct backend URL based on the current request origin
    const backendUrl = request.headers.get("origin") || `${env.PROTOCOL}://${env.DOMAIN}`;

    const response = await fetch(`${backendUrl}/internal/admin/impersonation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-flexile-auth": `Bearer ${session.user.jwt}`,
      },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: data.error || "Failed to impersonate user" }, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Impersonation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
