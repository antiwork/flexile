import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import env from "@/env"

const loginSchema = z.object({
  email: z.string().email(),
  otp_code: z.string().min(6).max(6),
})

// Define the backend API URL based on environment
const getBackendApiUrl = () => {
  switch (env.VERCEL_ENV) {
    case "production":
      return "https://api.flexile.com"
    case "preview":
      return `https://flexile-pipeline-pr-${process.env.VERCEL_GIT_PULL_REQUEST_ID}.herokuapp.com`
    default:
      return "https://flexile.dev"
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedFields = loginSchema.safeParse(body)

    if (!validatedFields.success) {
      return NextResponse.json(
        { error: "Invalid email or OTP code" },
        { status: 400 }
      )
    }

    const { email, otp_code } = validatedFields.data
    const backendUrl = getBackendApiUrl()

    // Call the backend login API
    const response = await fetch(`${backendUrl}/api/v1/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        otp_code,
        token: env.API_SECRET_TOKEN,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      return NextResponse.json(
        { error: errorData.error || "Authentication failed" },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Login API error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}