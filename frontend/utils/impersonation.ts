import { request } from "./request";

export interface ImpersonationStatus {
  impersonating: boolean;
  impersonated_user?: {
    id: string;
    email: string;
    name: string;
  };
  admin_user?: {
    id: string;
    email: string;
    name: string;
  };
}

export interface ImpersonationSession {
  impersonation_token: string;
  impersonated_user: {
    id: string;
    email: string;
    name: string;
  };
  admin_user: {
    id: string;
    email: string;
    name: string;
  };
  expires_at: string;
}

export interface ImpersonationUrlResponse {
  impersonation_url: string;
  token: string;
  expires_at: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

const IMPERSONATION_TOKEN_KEY = "flexile_impersonation_token";

export class ImpersonationService {
  // Start impersonation session with URL token
  static async startImpersonation(token: string): Promise<ImpersonationSession> {
    const response = await request({
      url: "/api/impersonation/start",
      method: "POST",
      accept: "json",
      jsonData: { token },
      assertOk: true,
    });

    const session = await response.json() as ImpersonationSession;
    
    // Store impersonation token in localStorage
    localStorage.setItem(IMPERSONATION_TOKEN_KEY, session.impersonation_token);
    
    return session;
  }

  // Stop impersonation session
  static async stopImpersonation(): Promise<void> {
    await request({
      url: "/api/impersonation/stop",
      method: "POST",
      accept: "json",
      assertOk: true,
    });

    // Remove impersonation token from localStorage
    localStorage.removeItem(IMPERSONATION_TOKEN_KEY);
  }

  // Get current impersonation status
  static async getImpersonationStatus(): Promise<ImpersonationStatus> {
    const response = await request({
      url: "/api/impersonation/status",
      method: "GET",
      accept: "json",
      assertOk: true,
    });

    return await response.json() as ImpersonationStatus;
  }

  // Generate impersonation URL for a user (admin only)
  static async generateImpersonationUrl(userId: string): Promise<ImpersonationUrlResponse> {
    const response = await request({
      url: "/api/impersonation/generate_url",
      method: "POST",
      accept: "json",
      jsonData: { user_id: userId },
      assertOk: true,
    });

    return await response.json() as ImpersonationUrlResponse;
  }

  // Get stored impersonation token
  static getImpersonationToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(IMPERSONATION_TOKEN_KEY);
  }

  // Check if currently impersonating (client-side check)
  static isImpersonating(): boolean {
    return this.getImpersonationToken() !== null;
  }

  // Clear impersonation token (for logout/cleanup)
  static clearImpersonationToken(): void {
    if (typeof window !== "undefined") {
      localStorage.removeItem(IMPERSONATION_TOKEN_KEY);
    }
  }
}
