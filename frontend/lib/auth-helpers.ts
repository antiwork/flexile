// Client-safe auth helper functions (no server-only imports)

// Helper functions for impersonation token management
export async function setImpersonationToken(impersonationJwt: string) {
  if (!impersonationJwt) {
    throw new Error("Impersonation JWT is required");
  }

  // Store the impersonation JWT in both localStorage and cookies
  localStorage.setItem("impersonation_jwt", impersonationJwt);
  localStorage.setItem("is_impersonating", "true");

  // Set HTTP-only cookie for server-side access
  document.cookie = `impersonation_jwt=${impersonationJwt}; path=/; max-age=900; samesite=lax`; // 15 minutes
  document.cookie = `is_impersonating=true; path=/; max-age=900; samesite=lax`;

  // Force a page refresh to reload the session with the new JWT
  window.location.reload();
}

export async function clearImpersonationToken() {
  // Remove impersonation JWT from localStorage
  localStorage.removeItem("impersonation_jwt");
  localStorage.removeItem("is_impersonating");

  // Clear cookies
  document.cookie = "impersonation_jwt=; path=/; max-age=0";
  document.cookie = "is_impersonating=; path=/; max-age=0";

  // Force a page refresh to reload the session without impersonation
  window.location.reload();
}

interface SessionData {
  user?: {
    jwt?: string;
  };
}

export function getActiveJwt(session: unknown) {
  try {
    if (!session || typeof session !== 'object') {
      return null;
    }
    
    // Type guard to check if session has the expected structure
    if (!('user' in session) || !session.user || typeof session.user !== 'object') {
      return null;
    }
    
    const sessionData = session as SessionData;
    if (!sessionData?.user) {
      return null;
    }

    // Check localStorage for impersonation JWT first
    if (typeof window !== "undefined") {
      const impersonationJwt = localStorage.getItem("impersonation_jwt");
      const isImpersonating = localStorage.getItem("is_impersonating") === "true";

      if (isImpersonating && impersonationJwt) {
        return impersonationJwt;
      }
    }

    // Fall back to original JWT from session
    const originalJwt = sessionData.user.jwt;

    if (!originalJwt) {
      return null;
    }

    return originalJwt;
  } catch {
    return null;
  }
}
