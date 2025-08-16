/**
 * Centralized backend URL configuration
 */

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

// TODO (techdebt): centralize runtime config resolution and normalization
export const getBackendUrl = (): string =>
  normalizeBaseUrl(process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001");

export const getPublicBackendUrl = (): string =>
  normalizeBaseUrl(process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || "http://localhost:5001");
