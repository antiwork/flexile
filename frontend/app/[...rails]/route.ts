import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { API_SECRET_TOKEN } from "@/lib/api";
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

  // Get NextAuth session to extract JWT token
  const session = await getServerSession(authOptions);

  const headers = new Headers(req.headers);

  // Add JWT token to x-flexile-auth header if user is authenticated via OTP
  if (session?.user && "jwt" in session.user) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const userWithJwt = session.user as typeof session.user & { jwt: string };
    headers.set("x-flexile-auth", `Bearer ${userWithJwt.jwt}`);
  }

  // Add API secret token for API requests
  let finalUrl = url;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/v1/")) {
    if (API_SECRET_TOKEN) {
      // For API requests, we need to pass both JWT and API secret token
      const requestUrl = new URL(url);
      requestUrl.searchParams.set("token", API_SECRET_TOKEN);
      finalUrl = requestUrl;
    }
  }

  const data = {
    headers,
    body: req.body,
    method: req.method,
    duplex: "half",
    redirect: "manual",
  } as const;
  const response = await fetch(finalUrl, data);

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
