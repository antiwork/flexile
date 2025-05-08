import { notFound } from "next/navigation";

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
  const data = {
    headers: req.headers,
    body: req.body,
    method: req.method,
    duplex: "half",
    redirect: "manual",
  } as const;
  const response = await fetch(url, data);

  const headers = new Headers(response.headers);
  headers.delete("content-encoding");
  headers.delete("content-length");
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

export { handler as DELETE, handler as GET, handler as PATCH, handler as POST, handler as PUT };
