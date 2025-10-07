"use client";

import { useState } from "react";
import { ImpersonationService } from "@/utils/impersonation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Copy, User, AlertTriangle, CheckCircle } from "lucide-react";
import { useCurrentUser } from "@/global";

interface ImpersonateButtonProps {
  userId: string;
  userName: string;
  userEmail: string;
}

export default function ImpersonateButton({ userId, userName, userEmail }: ImpersonateButtonProps) {
  const currentUser = useCurrentUser();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [impersonationUrl, setImpersonationUrl] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Only show for admin users
  if (!currentUser.roles.administrator) {
    return null;
  }

  const handleGenerateUrl = async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await ImpersonationService.generateImpersonationUrl(userId);
      setImpersonationUrl(response.impersonation_url);
      setSuccess(true);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to generate impersonation URL:", error);
      setError("Failed to generate impersonation URL. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(impersonationUrl);
      // Could add a toast notification here
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to copy URL:", error);
    }
  };

  const handleOpenUrl = () => {
    window.open(impersonationUrl, "_blank");
  };

  const handleClose = () => {
    setIsOpen(false);
    setImpersonationUrl("");
    setError("");
    setSuccess(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="small">
          <User className="h-4 w-4 mr-2" />
          Impersonate
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Impersonate User</DialogTitle>
          <DialogDescription>
            Generate a secure impersonation link for {userName} ({userEmail}).
            The link will expire in 5 minutes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Impersonation URL generated successfully. The link will expire in 5 minutes.
              </AlertDescription>
            </Alert>
          )}

          {impersonationUrl && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Impersonation URL:</label>
              <div className="flex gap-2">
                <Input
                  value={impersonationUrl}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="small"
                  onClick={handleCopyUrl}
                  title="Copy URL"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
          {impersonationUrl ? (
            <Button onClick={handleOpenUrl}>
              Open Impersonation
            </Button>
          ) : (
            <Button
              onClick={handleGenerateUrl}
              disabled={isLoading}
            >
              {isLoading ? "Generating..." : "Generate URL"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
