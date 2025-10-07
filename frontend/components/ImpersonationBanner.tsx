"use client";

import { useEffect, useState } from "react";
import { ImpersonationService, type ImpersonationStatus } from "@/utils/impersonation";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { User, X } from "lucide-react";

export default function ImpersonationBanner() {
  const [status, setStatus] = useState<ImpersonationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);

    const checkImpersonationStatus = async () => {
      try {
        const impersonationStatus = await ImpersonationService.getImpersonationStatus();
        setStatus(impersonationStatus);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to check impersonation status:", error);
        // If we can't check status but have a token, assume we're impersonating
        if (ImpersonationService.isImpersonating()) {
          setStatus({
            impersonating: true,
            impersonated_user: {
              id: "",
              email: "Unknown User",
              name: "Unknown User"
            }
          });
        }
      }
    };

    const handleStopImpersonation = async () => {
      setIsLoading(true);
      try {
        await ImpersonationService.stopImpersonation();
        setStatus(null);
        // Refresh the page to clear any cached user data
        window.location.reload();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to stop impersonation:", error);
      } finally {
        // Even if the API call fails, clear the local token and refresh
        ImpersonationService.clearImpersonationToken();
        window.location.reload();
      } finally {
        setIsLoading(false);
      }

  if (!status?.impersonating) {
    return null;
  }

  return (
    <Alert className="rounded-none border-x-0 border-t-0 bg-orange-50 border-orange-200 text-orange-800">
      <User className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          <span className="font-medium">
            Impersonating: {status.impersonated_user?.name || status.impersonated_user?.email}
          </span>
          {status.admin_user && (
            <span className="text-sm opacity-75">
              as {status.admin_user.name || status.admin_user.email}
            </span>
          )}
        </div>
        <Button
          variant="outline"
          size="small"
          onClick={handleStopImpersonation}
          disabled={isLoading}
          className="ml-4 bg-white hover:bg-gray-50"
        >
          <X className="h-3 w-3 mr-1" />
          {isLoading ? "Stopping..." : "Stop"}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
