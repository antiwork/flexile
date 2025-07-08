import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { z } from "zod"
import env from "@/env"

// Define the API base URL based on environment
const API_BASE_URL = (() => {
  switch (env.VERCEL_ENV) {
    case "production":
      return "https://api.flexile.com"
    case "preview":
      return `https://flexile-pipeline-pr-${process.env.VERCEL_GIT_PULL_REQUEST_ID}.herokuapp.com`
    default:
      return "http://localhost:3000"
  }
})()

const API_TOKEN = env.API_SECRET_TOKEN

// Schema for OTP login
const otpLoginSchema = z.object({
  email: z.string().email(),
  otp_code: z.string().min(6).max(6),
})

// Schema for sending OTP
const sendOtpSchema = z.object({
  email: z.string().email(),
})

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: env.AUTH_SECRET,
  providers: [
    Credentials({
      id: "otp",
      name: "OTP",
      credentials: {
        email: { label: "Email", type: "email" },
        otp_code: { label: "OTP Code", type: "text" }
      },
      async authorize(credentials) {
        try {
          const validatedFields = otpLoginSchema.safeParse(credentials)

          if (!validatedFields.success) {
            return null
          }

          const { email, otp_code } = validatedFields.data

          // Call the backend login API
          const response = await fetch(`${API_BASE_URL}/api/v1/login`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email,
              otp_code,
              token: API_TOKEN,
            }),
          })

          if (!response.ok) {
            return null
          }

          const data = await response.json()

          if (data.jwt && data.user) {
            return {
              id: data.user.id.toString(),
              email: data.user.email,
              name: data.user.name,
              jwt: data.jwt,
            }
          }

          return null
        } catch (error) {
          console.error("Auth error:", error)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.jwt = user.jwt
      }
      return token
    },
    async session({ session, token }) {
      if (token.jwt) {
        session.jwt = token.jwt
      }
      return session
    },
  },
  pages: {
    signIn: "/login2",
  },
})

// Helper function to send OTP
export async function sendOTP(email: string) {
  try {
    const validatedFields = sendOtpSchema.safeParse({ email })

    if (!validatedFields.success) {
      throw new Error("Invalid email")
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/email_otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        token: API_TOKEN,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to send OTP")
    }

    return await response.json()
  } catch (error) {
    console.error("Send OTP error:", error)
    throw error
  }
}