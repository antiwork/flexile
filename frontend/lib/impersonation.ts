import type { Session } from "next-auth";

export interface ImpersonationData {
  jwt: string;
  user: {
    id: number;
    email: string;
    name: string;
    legal_name?: string;
    preferred_name?: string;
  };
  originalUser: {
    id: string;
    email: string;
    name: string;
    legalName?: string;
    preferredName?: string;
    jwt: string;
  };
}

export interface ImpersonationResponse {
  success: boolean;
  error?: string;
  impersonation_jwt?: string;
  user?: {
    id: number;
    email: string;
    name: string;
    legal_name?: string;
    preferred_name?: string;
  };
}

export function isValidImpersonationData(data: unknown): data is ImpersonationData {
  if (!data || typeof data !== "object") return false;

  const impersonation = data;
  return Boolean(
    impersonation &&
      typeof impersonation === "object" &&
      "jwt" in impersonation &&
      typeof impersonation.jwt === "string" &&
      "user" in impersonation &&
      impersonation.user &&
      typeof impersonation.user === "object" &&
      "originalUser" in impersonation &&
      impersonation.originalUser &&
      typeof impersonation.originalUser === "object",
  );
}

function isImpersonationResponse(data: unknown): data is ImpersonationResponse {
  if (!data || typeof data !== "object") return false;
  return "success" in data && typeof data.success === "boolean";
}

export function isCurrentlyImpersonating(session: Session | null): boolean {
  return Boolean(session?.impersonation);
}

export function getImpersonatedUserEmail(session: Session | null): string {
  return session?.impersonation?.user?.email || "Unknown";
}

export async function startImpersonation(
  email: string,
  session: Session | null,
  updateSession: (data: Partial<Session>) => Promise<Session | null>,
): Promise<{ success: boolean; error?: string }> {
  const trimmedEmail = email.trim();
  if (!trimmedEmail) {
    return { success: false, error: "Please enter an email address" };
  }

  if (!session?.user) {
    return { success: false, error: "No authenticated user found" };
  }

  try {
    const response = await fetch("/api/admin/impersonate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: trimmedEmail }),
    });

    const data: unknown = await response.json();
    if (!data || typeof data !== "object") {
      return { success: false, error: "Invalid response from server" };
    }

    if (!isImpersonationResponse(data)) {
      return { success: false, error: "Invalid response format from server" };
    }

    const responseData = data;

    if (!response.ok) {
      return { success: false, error: responseData.error ?? "Failed to impersonate user" };
    }

    if (!responseData.impersonation_jwt || !responseData.user) {
      return { success: false, error: "Invalid response from server" };
    }

    await updateSession({
      ...session,
      impersonation: {
        jwt: responseData.impersonation_jwt,
        user: responseData.user,
        originalUser: session.user,
      },
    });

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "An error occurred",
    };
  }
}

export async function stopImpersonation(
  session: Session | null,
  updateSession: (data: Partial<Session>) => Promise<Session | null>,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { impersonation, ...sessionWithoutImpersonation } = session || {};
    await updateSession(sessionWithoutImpersonation);

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to stop impersonation",
    };
  }
}
