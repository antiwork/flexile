import crypto from "crypto";
import { WebClient } from "@slack/web-api";
import env from "@/env";

export const slackClient = new WebClient(env.SLACK_TOKEN, {
  headers: {
    "Accept-Encoding": "identity",
  },
});

export const verifySlackRequest = (body: string, headers: Headers): Promise<boolean> => {
  const slackSignature = headers.get("x-slack-signature");
  const timestamp = headers.get("x-slack-request-timestamp");
  const slackSigningSecret = env.SLACK_SIGNING_SECRET;

  if (
    !slackSignature ||
    !slackSigningSecret ||
    !timestamp ||
    new Date(Number(timestamp) * 1000).getTime() < Date.now() - 300 * 1000
  ) {
    return Promise.resolve(false);
  }

  const baseString = `v0:${timestamp}:${body}`;
  const hmac = crypto.createHmac("sha256", slackSigningSecret);
  const computedSignature = `v0=${hmac.update(baseString).digest("hex")}`;

  return Promise.resolve(crypto.timingSafeEqual(Buffer.from(computedSignature), Buffer.from(slackSignature)));
};
