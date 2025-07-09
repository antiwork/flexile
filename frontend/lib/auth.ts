import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { z } from "zod"

// Get the Next.js application URL
const getNextJsUrl = () => {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL
  }
  // Fallback for local development
  return "https://flexile.dev"
}

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
  secret: process.env.AUTH_SECRET || "fallback-secret-for-development",
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

          // Call the Next.js login API
          const nextJsUrl = getNextJsUrl()
          const response = await fetch(`${nextJsUrl}/api/auth/login`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email,
              otp_code,
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
      if (user && user.jwt) {
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

    const nextJsUrl = getNextJsUrl()
    const response = await fetch(`${nextJsUrl}/api/auth/send-otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
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