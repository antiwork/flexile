"use client";

import GithubUserConnection from "../GithubUserConnection";

export default function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Integrations</h1>
        <p className="text-muted-foreground mt-2">Connect your accounts to verify your work.</p>
      </div>

      <div className="space-y-4">
        {/* GitHub Integration */}
        <GithubUserConnection />
      </div>
    </div>
  );
}
