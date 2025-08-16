/**
 * Centralized backend URL configuration
 */
export const getBackendUrl = (): string => process.env.BACKEND_URL || "http://127.0.0.1:5001";

export const getPublicBackendUrl = (): string => process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001";
