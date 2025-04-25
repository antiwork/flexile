import { InstallProvider } from "@slack/oauth";
import env from "@/env";

export type SlackIntegrationConfiguration = {
  team_id: string;
  team_name?: string | null;
  app_id: string;
  bot_user_id: string;
  bot_token: string; // Encrypted
};

// Initialize the Slack InstallProvider
export const slackInstallProvider = new InstallProvider({
  clientId: env.SLACK_CLIENT_ID,
  clientSecret: env.SLACK_CLIENT_SECRET,
  stateSecret: env.SLACK_STATE_SECRET,
  installationStore: {
    async saveInstallation(installation) {
      await db.insert(integrations).values({
        type: "SlackIntegration",
      });
    },
  },
});
