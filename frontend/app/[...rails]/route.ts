import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import env from "@/env";
import { authOptions } from "@/lib/auth";

async function handler(req: Request) {
  const routes = ["^/internal/", "^/api/", "^/admin/", "^/admin$", "^/webhooks/", "^/v1/", "^/rails/", "^/assets/"];
  const url = new URL(req.url);
  if (!routes.some((route) => url.pathname.match(route))) {
    throw notFound();
  }
  switch (process.env.VERCEL_ENV) {
    case "production":
      url.host = "api.flexile.com";
      break;
    case "preview":
      url.hostname = `flexile-pipeline-pr-${process.env.VERCEL_GIT_PULL_REQUEST_ID}.herokuapp.com`;
      break;
    default:
      url.port = process.env.RAILS_ENV === "test" ? "3100" : "3000";
      url.protocol = "http";
  }

  const session = await getServerSession(authOptions);

  const headers = new Headers(req.headers);

  if (session?.user) {
    // Check for impersonation JWT in cookies first
    const cookies = req.headers.get('cookie');
    const impersonationJwt = cookies?.match(/impersonation_jwt=([^;]+)/u)?.[1];
    const isImpersonating = cookies?.includes('is_impersonating=true');
    
    // Use impersonation JWT if available, otherwise use original session JWT
    const activeJwt = (isImpersonating && impersonationJwt) ? impersonationJwt : session.user.jwt;
    headers.set("x-flexile-auth", `Bearer ${activeJwt}`);
  }

  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/v1/")) {
    url.searchParams.set("token", env.API_SECRET_TOKEN);
  }

  const data = {
    headers,
    body: req.body,
    method: req.method,
    duplex: "half",
    redirect: "manual",
  } as const;
  const response = await fetch(url, data);

  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");
  return new Response(response.body, {
    headers: responseHeaders,
    status: response.status,
    statusText: response.statusText,
  });
}

export { handler as DELETE, handler as GET, handler as PATCH, handler as POST, handler as PUT };
