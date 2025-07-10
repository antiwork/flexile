"use client";

import { getSession } from "next-auth/react";

export interface ApiClientOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: any;
  headers?: Record<string, string>;
  useJWT?: boolean;
}

export class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = ""; // Use relative URLs for Next.js API routes
  }

  async request<T>(endpoint: string, options: ApiClientOptions = {}): Promise<T> {
    const { method = "GET", body, headers = {}, useJWT = true } = options;

    const url = `${this.baseUrl}${endpoint}`;

    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...headers,
    };

    // Add JWT token if available and requested
    if (useJWT) {
      const session = await getSession();
      if (session && (session as any).jwt) {
        requestHeaders["Authorization"] = `Bearer ${(session as any).jwt}`;
      }
    }

    const requestBody = body ? JSON.stringify(body) : undefined;

    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: requestBody,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error || errorMessage;
      } catch {
        // If parsing fails, use the raw text
        errorMessage = errorText || errorMessage;
      }

      throw new Error(errorMessage);
    }

    return await response.json();
  }

  // Convenience methods
  async get<T>(endpoint: string, options: Omit<ApiClientOptions, "method"> = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "GET" });
  }

  async post<T>(endpoint: string, data: any, options: Omit<ApiClientOptions, "method" | "body"> = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "POST", body: data });
  }

  async put<T>(endpoint: string, data: any, options: Omit<ApiClientOptions, "method" | "body"> = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "PUT", body: data });
  }

  async delete<T>(endpoint: string, options: Omit<ApiClientOptions, "method"> = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "DELETE" });
  }

  async patch<T>(endpoint: string, data: any, options: Omit<ApiClientOptions, "method" | "body"> = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "PATCH", body: data });
  }
}

// Export a singleton instance
export const apiClient = new ApiClient();

// Export convenience functions for OTP operations
export const sendOTP = async (email: string) => {
  return apiClient.post("/api/auth/send-otp", { email }, { useJWT: false });
};

export const verifyOTPLogin = async (email: string, otp_code: string) => {
  return apiClient.post("/api/auth/verify-otp", { email, otp_code }, { useJWT: false });
};