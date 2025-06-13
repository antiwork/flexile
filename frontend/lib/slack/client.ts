import crypto from "crypto";
import { WebClient } from "@slack/web-api";
import type { ModalView } from "@slack/web-api";

export const verifySlackRequest = (body: string, headers: Headers): Promise<boolean> => {
  const slackSignature = headers.get("x-slack-signature");
  const timestamp = headers.get("x-slack-request-timestamp");
  const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;

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

  if (Buffer.from(computedSignature).length !== Buffer.from(slackSignature).length) {
    return Promise.resolve(false);
  }
  return Promise.resolve(crypto.timingSafeEqual(Buffer.from(computedSignature), Buffer.from(slackSignature)));
};

export const openSlackModal = async ({
  token,
  triggerId,
  title,
  view,
}: {
  token: string;
  triggerId: string;
  title: string;
  view: Partial<ModalView>;
}) => {
  const client = new WebClient(token);
  const response = await client.views.open({
    trigger_id: triggerId,
    view: {
      type: "modal",
      title: {
        type: "plain_text",
        text: title,
      },
      submit: {
        type: "plain_text",
        text: "Submit invoice",
      },
      blocks: [],
      ...view,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to open Slack modal: ${response.error}`);
  }

  return response.view;
};

export const postSlackMessage = async (token: string, channel: string, text: string, ephemeralUserId?: string) => {
  const client = new WebClient(token);

  if (ephemeralUserId) {
    const response = await client.chat.postEphemeral({
      channel,
      user: ephemeralUserId,
      text,
    });
    return response.message_ts;
  }

  const response = await client.chat.postMessage({
    channel,
    text,
  });
  return response.message?.ts;
};
