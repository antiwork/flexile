import crypto from "crypto";
import { WebClient } from "@slack/web-api";
import env from "@/env";

export const slackClient = new WebClient(env.SLACK_TOKEN, {
  headers: {
    "Accept-Encoding": "identity",
  },
});

export const verifySlackRequest = async (body: string, headers: Headers): Promise<boolean> => {
  const timestamp = headers.get("x-slack-request-timestamp");
  const signature = headers.get("x-slack-signature");

  if (!timestamp || !signature || !env.SLACK_TOKEN) {
    return Promise.resolve(false);
  }

  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
  if (parseInt(timestamp, 10) < fiveMinutesAgo) {
    return Promise.resolve(false);
  }

  const hmac = crypto.createHmac("sha256", env.SLACK_TOKEN);
  const data = `v0:${timestamp}:${body}`;
  const checkSignature = `v0=${hmac.update(data).digest("hex")}`;

  return Promise.resolve(crypto.timingSafeEqual(Buffer.from(checkSignature), Buffer.from(signature)));
};
