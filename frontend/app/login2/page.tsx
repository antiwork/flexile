"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { sendOTP } from "@/lib/auth"
import SimpleLayout from "@/components/layouts/Simple"

export default function Login2() {
  const [email, setEmail] = useState("")
  const [otpCode, setOtpCode] = useState("")
  const [step, setStep] = useState<"email" | "otp">("email")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const router = useRouter()

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) {
      setError("Email is required")
      return
    }

    setLoading(true)
    setError("")
    setSuccess("")

    try {
      await sendOTP(email)
      setSuccess("OTP sent successfully! Check your email.")
      setStep("otp")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP")
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!otpCode) {
      setError("OTP code is required")
      return
    }

    setLoading(true)
    setError("")

    try {
      const result = await signIn("otp", {
        email,
        otp_code: otpCode,
        redirect: false,
      })

      if (result?.error) {
        setError("Invalid OTP code or authentication failed")
      } else if (result?.ok) {
        setSuccess("Login successful!")
        router.push("/dashboard")
      }
    } catch (err) {
      setError("Authentication failed")
    } finally {
      setLoading(false)
    }
  }

  const handleResendOTP = async () => {
    setLoading(true)
    setError("")
    setSuccess("")

    try {
      await sendOTP(email)
      setSuccess("OTP resent successfully!")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend OTP")
    } finally {
      setLoading(false)
    }
  }

  const handleBackToEmail = () => {
    setStep("email")
    setOtpCode("")
    setError("")
    setSuccess("")
  }

  return (
    <SimpleLayout hideHeader>
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Login with OTP</CardTitle>
            <CardDescription>
              {step === "email"
                ? "Enter your email to receive an OTP code"
                : "Enter the OTP code sent to your email"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert className="mb-4 border-red-200 bg-red-50">
                <AlertDescription className="text-red-700">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="mb-4 border-green-200 bg-green-50">
                <AlertDescription className="text-green-700">
                  {success}
                </AlertDescription>
              </Alert>
            )}

            {step === "email" ? (
              <form onSubmit={handleSendOTP} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Sending..." : "Send OTP"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOTP} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email-display">Email</Label>
                  <Input
                    id="email-display"
                    type="email"
                    value={email}
                    disabled
                    className="bg-gray-50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="otp">OTP Code</Label>
                  <Input
                    id="otp"
                    type="text"
                    placeholder="Enter 6-digit OTP"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    maxLength={6}
                    required
                    disabled={loading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Verifying..." : "Verify OTP"}
                </Button>
                <div className="flex justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBackToEmail}
                    disabled={loading}
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleResendOTP}
                    disabled={loading}
                  >
                    Resend OTP
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </SimpleLayout>
  )
}