import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import env from "@/env";

export default function middleware(req: NextRequest) {
  // TODO: Bring back nonce and remove unsafe-inline
  // const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const { NODE_ENV } = process.env; // destructure to prevent inlining
  const s3Urls = [env.S3_PRIVATE_BUCKET, env.S3_PUBLIC_BUCKET]
    .map((bucket) => `https://${bucket}.s3.${env.AWS_REGION}.amazonaws.com https://${bucket}.s3.amazonaws.com`)
    .join(" ");
  const helperUrls = ["https://help.flexile.com", "wss://xmrztjqxvugqpgvxpmzz.supabase.co/realtime/v1/websocket"].join(
    " ",
  );

  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-inline' https://cdn.docuseal.com https://js.stripe.com ${NODE_ENV === "production" ? "" : `'unsafe-eval'`};
    style-src 'self' 'unsafe-inline';
    connect-src 'self' https://docuseal.com ${helperUrls} ${s3Urls};
    img-src 'self' blob: data: https://docuseal.com https://docuseal.s3.amazonaws.com ${s3Urls};
    worker-src 'self' blob:;
    font-src 'self';
    base-uri 'self';
    frame-ancestors ${NODE_ENV === "production" ? "'none'" : "'self'"};
    frame-src 'self' https://challenges.cloudflare.com https://js.stripe.com https://www.youtube.com;
    form-action 'self';
    upgrade-insecure-requests;
  `
    .replace(/\s{2,}/gu, " ")
    .trim();

  const requestHeaders = new Headers(req.headers);
  // requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", cspHeader);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", cspHeader);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
