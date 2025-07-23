import React from "react";
import { Alert, AlertDescription } from "../ui/alert";

interface AuthAlertsProps {
  error?: string;
  success?: string;
}

export const AuthAlerts = ({ error, success }: AuthAlertsProps) => (
  <>
    {error ? (
      <Alert variant="destructive" className="mb-4">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    ) : null}

    {success ? (
      <Alert className="mb-4">
        <AlertDescription>{success}</AlertDescription>
      </Alert>
    ) : null}
  </>
);
