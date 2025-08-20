import { useSession } from "next-auth/react";
import { useState } from "react";
import { clearImpersonationToken, getActiveJwt, setImpersonationToken } from "@/lib/auth-helpers";
import { request } from "./request";

interface ImpersonationResponse {
  token: string;
  user: {
    id: number;
    email: string;
    legal_name: string | null;
    preferred_name: string | null;
  };
}

export function useImpersonation() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: session } = useSession();

  const startImpersonation = async (impersonationToken: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const currentJwt = getActiveJwt(session);
      if (!currentJwt) {
        throw new Error("No authentication token found. Please log in again.");
      }

      if (!impersonationToken?.trim()) {
        throw new Error("Impersonation token is required");
      }

      const response = await request({
        method: "POST",
        accept: "json",
        url: "/admin/impersonate",
        headers: {
          "x-flexile-auth": `Bearer ${currentJwt}`,
        },
        jsonData: {
          token: impersonationToken,
        },
        assertOk: true,
      });

      if (!response.ok) {
        const errorData = await response.text();
        switch (response.status) {
          case 401:
            throw new Error("Unauthorized. You don't have permission to impersonate users.");
          case 403:
            throw new Error("Forbidden. Admin access required for impersonation.");
          case 404:
            throw new Error("User not found or impersonation token is invalid.");
          case 422:
            throw new Error("Invalid impersonation token format or expired token.");
          default:
            throw new Error(`Server error (${response.status}): ${errorData}`);
        }
      }

      const data: ImpersonationResponse = await response.json();

      if (!data.token || !data.user) {
        throw new Error("Invalid response from server. Missing token or user data.");
      }

      // Store the impersonation JWT in the session
      await setImpersonationToken(data.token);

      return data;
    } catch (err) {
      let errorMessage = "Failed to start impersonation";

      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === "string") {
        errorMessage = err;
      }

      setError(errorMessage);

      // Log error for debugging (only in development)
      // Errors are handled by error state

      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const stopImpersonation = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Check for active impersonation in cookies/localStorage
      const hasImpersonationCookie = typeof window !== "undefined" && document.cookie.includes("is_impersonating=true");
      const hasLocalStorageFlag = typeof window !== "undefined" && localStorage.getItem("is_impersonating") === "true";

      if (!hasImpersonationCookie && !hasLocalStorageFlag) {
        throw new Error("No active impersonation session found");
      }

      // Clear the impersonation JWT from cookies and localStorage
      await clearImpersonationToken();

      // Add a small delay to ensure cleanup is processed
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Redirect to refresh the page and clear any impersonated state
      window.location.reload();
    } catch (err) {
      let errorMessage = "Failed to stop impersonation";

      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === "string") {
        errorMessage = err;
      }

      setError(errorMessage);

      // Log error for debugging (only in development)
      // Errors are handled by error state

      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
  };

  return {
    startImpersonation,
    stopImpersonation,
    clearError,
    isLoading,
    error,
    isImpersonating: session?.user?.isImpersonating || false,
  };
}
