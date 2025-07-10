"use client";

import { useSession } from "next-auth/react";
import { useUser } from "@clerk/nextjs";

export function useAuthSession() {
  const { data: nextAuthSession, status: nextAuthStatus } = useSession();
  const { user: clerkUser, isLoaded: clerkLoaded, isSignedIn: clerkSignedIn } = useUser();

  // Check if user is authenticated via NextAuth (OTP)
  const isOTPAuthenticated = nextAuthStatus === "authenticated" && nextAuthSession;

  // Check if user is authenticated via Clerk
  const isClerkAuthenticated = clerkLoaded && clerkSignedIn && clerkUser;

  // Return the appropriate session data
  if (isOTPAuthenticated && nextAuthSession.user) {
    const user = nextAuthSession.user as any;
    const session = nextAuthSession as any;
    return {
      user: {
        id: user.id,
        email: user.email || "",
        name: user.name || "",
        legalName: user.legalName,
        preferredName: user.preferredName,
      },
      jwt: session.jwt,
      authType: "otp" as const,
      isAuthenticated: true,
      isLoading: false,
    };
  }

  if (isClerkAuthenticated) {
    return {
      user: {
        id: clerkUser.id,
        email: clerkUser.emailAddresses[0]?.emailAddress || "",
        name: clerkUser.fullName || "",
        legalName: clerkUser.firstName || "",
        preferredName: clerkUser.firstName || "",
      },
      jwt: null,
      authType: "clerk" as const,
      isAuthenticated: true,
      isLoading: !clerkLoaded,
    };
  }

  return {
    user: null,
    jwt: null,
    authType: null,
    isAuthenticated: false,
    isLoading: nextAuthStatus === "loading" || !clerkLoaded,
  };
}

export function useIsAuthenticated() {
  const { isAuthenticated, isLoading } = useAuthSession();
  return { isAuthenticated, isLoading };
}