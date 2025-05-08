import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json([
    "^/internal/",
    "^/api/",
    "^/admin/",
    "^/admin$",
    "^/webhooks/",
    "^/v1/",
    "^/rails/",
    "^/assets/",
  ]);
}
