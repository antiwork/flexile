"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentCompany } from "@/global";
import { request } from "@/utils/request";

export default function GithubSettings() {
  const company = useCurrentCompany();
  const [isConnecting, setIsConnecting] = useState(false);
  const queryClient = useQueryClient();

  const connectMutation = useMutation({
    mutationFn: async () => {
      const response = await request({
        url: "/internal/oauth/github/authorize?scope=company",
        method: "GET",
      });
      const data = await response.json();
      return data.url;
    },
    onSuccess: (url) => {
      window.location.href = url;
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await request({
        url: "/internal/oauth/github/disconnect?scope=company",
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
    },
  });

  const handleConnect = () => {
    setIsConnecting(true);
    connectMutation.mutate();
  };

  const handleDisconnect = () => {
    disconnectMutation.mutate();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>GitHub Integration</CardTitle>
        <CardDescription>
          Connect your GitHub organization to enable PR tracking and bounty management.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {company.githubOrganization ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Connected to organization: <strong>{company.githubOrganization}</strong>
            </p>
            <Button
              variant="outline"
              onClick={handleDisconnect}
              disabled={disconnectMutation.isPending}
            >
              {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect"}
            </Button>
          </div>
        ) : (
          <Button onClick={handleConnect} disabled={isConnecting || connectMutation.isPending}>
            {isConnecting || connectMutation.isPending ? "Connecting..." : "Connect GitHub Organization"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}