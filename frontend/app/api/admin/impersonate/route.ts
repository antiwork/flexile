import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import env from "@/env";
import { authOptions } from "@/lib/auth";
import type { ImpersonationResponse } from "@/lib/impersonation";

const impersonationRequestSchema = z.object({
  email: z.string().email().min(1, "Email is required"),
});

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user.jwt) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: unknown = await request.json();
    const validation = impersonationRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || "Invalid request body" },
        { status: 400 },
      );
    }

    const { email } = validation.data;
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

    function isImpersonationResponse(obj: unknown): obj is ImpersonationResponse {
      if (!obj || typeof obj !== "object") return false;
      return "success" in obj && typeof obj.success === "boolean";
    }

    if (!isImpersonationResponse(data)) {
      return NextResponse.json({ error: "Invalid response format from server" }, { status: 500 });
    }

    const responseData = data;

    if (!response.ok) {
      return NextResponse.json(
        { error: responseData.error ?? "Failed to impersonate user" },
        { status: response.status },
      );
    }

    return NextResponse.json(responseData);
  } catch (error) {
    // eslint-disable-next-line no-console -- Error logging
    console.error("Impersonation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
