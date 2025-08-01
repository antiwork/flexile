import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import env from "@/env";

export default clerkMiddleware((_, req) => {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const clerkFapiUrl = Buffer.from(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.slice(8), "base64")
    .toString("utf-8")
    .slice(0, -1);
  const { NODE_ENV } = process.env; // destructure to prevent inlining
  const s3Urls = [env.S3_PRIVATE_BUCKET, env.S3_PUBLIC_BUCKET]
    .map((bucket) => `https://${bucket}.s3.${env.AWS_REGION}.amazonaws.com https://${bucket}.s3.amazonaws.com`)
    .join(" ");
  const helperUrls = ["https://help.flexile.com", "wss://xmrztjqxvugqpgvxpmzz.supabase.co/realtime/v1/websocket"].join(
    " ",
  );

  const cspHeader = `
    default-src 'self';
    script-src 'self' 'strict-dynamic' 'nonce-${nonce}' ${
      NODE_ENV === "production" ? "" : `'unsafe-eval'` // required by Clerk, as is style-src 'unsafe-inline' and worker-src blob:.
    };
    style-src 'self' 'unsafe-inline';
    connect-src 'self' ${clerkFapiUrl} https://docuseal.com ${helperUrls} ${s3Urls};
    img-src 'self' blob: data: https://img.clerk.com https://docuseal.com https://docuseal.s3.amazonaws.com ${s3Urls};
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
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", cspHeader);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", cspHeader);
  return response;
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
