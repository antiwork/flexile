import type { NextAuthOptions, User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { z } from "zod";
import { API_BASE_URL, API_SECRET_TOKEN } from "./api";

if (!process.env.NEXTAUTH_SECRET) {
  throw new Error("NEXTAUTH_SECRET environment variable is required");
}

const otpLoginSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
});

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: "otp",
      name: "Email OTP",
      credentials: {
        email: {
          label: "Email",
          type: "email",
          placeholder: "Enter your email",
        },
        otp: {
          label: "OTP Code",
          type: "text",
          placeholder: "Enter 6-digit OTP",
        },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.otp) {
          throw new Error("Email and OTP are required");
        }

        const validation = otpLoginSchema.safeParse({
          email: credentials.email,
          otp: credentials.otp,
        });

        if (!validation.success) {
          throw new Error("Invalid email or OTP");
        }

        try {
          const response = await fetch(`${API_BASE_URL}/v1/login`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: validation.data.email,
              otp_code: validation.data.otp,
              token: API_SECRET_TOKEN,
            }),
          });

          if (!response.ok) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const errorData = await response.json();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            throw new Error(errorData.error || "Authentication failed, please try again.");
          }

          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/consistent-type-assertions
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

          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/consistent-type-assertions
          return {
            id: data.user.id.toString(),
            email: data.user.email,
            name: data.user.name,
            legalName: data.user.legal_name,
            preferredName: data.user.preferred_name,
            jwt: data.jwt,
          } as User;
        } catch (error) {
          if (error instanceof Error) {
            throw error;
          }
          throw new Error("Authentication failed, please try again.");
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions
        const customUser = user as any;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        token.jwt = customUser.jwt;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        token.legalName = customUser.legalName;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        token.preferredName = customUser.preferredName;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions
        (session.user as any).id = token.sub || "";
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions
        (session.user as any).jwt = token.jwt || "";
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions
        (session.user as any).legalName = token.legalName;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions
        (session.user as any).preferredName = token.preferredName;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET || "",
};

// Helper function to send OTP email
export const sendOtpEmail = async (email: string) => {
  const response = await fetch(`${API_BASE_URL}/v1/email_otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      token: API_SECRET_TOKEN,
    }),
  });

  if (!response.ok) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/consistent-type-assertions
    const errorData = (await response.json()) as { error?: string };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    throw new Error(errorData.error || "Failed to send OTP");
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/consistent-type-assertions
  return (await response.json()) as unknown;
};
