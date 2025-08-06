import { NextRequest } from "next/server";
import NextAuth from "next-auth";
import type { Account, User } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { authOptions } from "@/lib/auth";

function parseCookies(cookieHeader: string): Map<string, string> {
  const cookieMap = new Map<string, string>();
  if (!cookieHeader) return cookieMap;

  cookieHeader.split("; ").forEach((cookie) => {
    const [key, value] = cookie.split("=");
    if (key && value) {
      cookieMap.set(key, decodeURIComponent(value));
    }
  });

  return cookieMap;
}

function handler(req: NextRequest, context: { params: { nextauth: string[] } }) {
  const cookies = req.headers.get("cookie") || "";
  const cookieMap = parseCookies(cookies);
  const authContext = cookieMap.get("auth_context");

  const errorPage = authContext === "signup" ? "/signup" : "/login";

  const augmentedOptions = {
    ...authOptions,
    providers: [
      ...authOptions.providers,
      ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
        ? [
            GoogleProvider({
              clientId: process.env.GOOGLE_CLIENT_ID,
              clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            }),
          ]
        : []),
    ],
    callbacks: {
      ...authOptions.callbacks,
      async signIn({ user, account }: { user: User; account: Account | null }) {
        if (account?.provider === "google") {
          const cookies = req.headers.get("cookie") || "";
          const cookieMap = parseCookies(cookies);

          const context = cookieMap.get("auth_context");
          const invitationToken = cookieMap.get("auth_invitation_token");

          const endpoint = context === "signup" ? "/api/google-signup" : "/api/google-login";
          const requestBody: Record<string, unknown> = {
            email: user.email,
            google_id: user.id,
          };

          if (invitationToken) {
            requestBody.invitation_token = invitationToken;
          }

          const response = await fetch(`${process.env.NEXTAUTH_URL}${endpoint}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
          });

          if (!response.ok) {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            const errorData = (await response.json().catch(() => ({}))) as { error?: string };
            throw new Error(errorData.error || "Authentication failed");
          }

          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          const data = (await response.json()) as {
            user: {
              id: number;
              email: string;
              name: string;
              legal_name?: string;
              preferred_name?: string;
            };
            jwt: string;
          };

          user.jwt = data.jwt;
          user.legalName = data.user.legal_name || "";
          user.preferredName = data.user.preferred_name || "";
          user.id = data.user.id.toString();

          return true;
        }

        return true;
      },
    },
    pages: {
      ...authOptions.pages,
      error: errorPage,
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
  return NextAuth(augmentedOptions)(req, context);
}

export { handler as GET, handler as POST };
