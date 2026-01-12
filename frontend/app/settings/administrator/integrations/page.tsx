"use client";

import GithubIntegrationRow from "../GithubIntegration";

export default function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Integrations</h1>
        <p className="text-muted-foreground mt-2">Connect Flexile to your company&apos;s favorite tools.</p>
      </div>

      <div className="space-y-4">
        {/* GitHub Integration */}
        <div className="border-border bg-card rounded-lg border p-6">
          <GithubIntegrationRow />
        </div>
      </div>
    </div>
  );
}
