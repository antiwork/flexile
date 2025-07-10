import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { z } from "zod";

const API_BASE_URL = process.env.NODE_ENV === "production" ? "https://api.flexile.com" : "http://api.flexile.dev";
const API_SECRET_TOKEN = process.env.API_SECRET_TOKEN;

if (!API_SECRET_TOKEN) {
  throw new Error("API_SECRET_TOKEN environment variable is required");
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
        if (!credentials?.email || !credentials?.otp) {
          return null;
        }

        const validation = otpLoginSchema.safeParse({
          email: credentials.email,
          otp: credentials.otp,
        });

        if (!validation.success) {
          return null;
        }

        try {
          const response = await fetch(`${API_BASE_URL}/api/v1/login`, {
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
            console.error("OTP login failed:", await response.text());
            return null;
          }

          const data = await response.json();

          return {
            id: data.user.id.toString(),
            email: data.user.email,
            name: data.user.name,
            legalName: data.user.legal_name,
            preferredName: data.user.preferred_name,
            jwt: data.jwt,
          };
        } catch (error) {
          console.error("Error during OTP login:", error);
          return null;
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
    async jwt({ token, user }) {
      if (user) {
        token.jwt = user.jwt;
        token.legalName = user.legalName;
        token.preferredName = user.preferredName;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.sub!;
        session.user.jwt = token.jwt!;
        session.user.legalName = token.legalName;
        session.user.preferredName = token.preferredName;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login2",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

// Helper function to send OTP email
export const sendOtpEmail = async (email: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/email_otp`, {
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
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to send OTP");
    }

    return await response.json();
  } catch (error) {
    console.error("Error sending OTP:", error);
    throw error;
  }
};