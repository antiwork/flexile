import { OAuthApp } from "octokit";
import env from "@/env";

export default new OAuthApp({
  clientId: env.GH_CLIENT_ID,
  clientSecret: env.GH_CLIENT_SECRET,
});
