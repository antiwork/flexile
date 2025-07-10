"use client";
import { useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useUserStore } from "@/global";
import SimpleLayout from "@/components/layouts/Simple";

export default function LoginPage() {
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useUserStore();

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send OTP");
      }

      setSuccess("OTP sent successfully! Check your email.");
      setStep("otp");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await signIn("otp", {
        email,
        otp,
        redirect: false,
      });

      if (result?.error) {
        throw new Error("Invalid OTP code or login failed");
      }

      // Get the session to access the JWT
      const session = await getSession();
      if (session?.user && 'jwt' in session.user) {
        // Fetch user data from backend using the JWT
        const userResponse = await fetch("/api/user-data", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ jwt: (session.user as any).jwt }),
        });

        if (userResponse.ok) {
          const userData = await userResponse.json();
          login(userData);
        }
      }

      // Handle redirect
      const redirectUrl = searchParams.get("redirect_url");
      const targetUrl = redirectUrl && redirectUrl.startsWith("/") && !redirectUrl.startsWith("//")
        ? redirectUrl
        : "/dashboard";

      router.push(targetUrl as any);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToEmail = () => {
    setStep("email");
    setOtp("");
    setError("");
    setSuccess("");
  };

  return (
    <SimpleLayout hideHeader>
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Login with email</CardTitle>
            <CardDescription>
              {step === "email"
                ? "Enter your email address to receive a verification code"
                : "Enter the 6-digit code sent to your email"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="mb-4">
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            {step === "email" ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
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
                  {loading ? "Sending..." : "Send verification code"}
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="text-sm text-gray-600">
                  Verification code sent to: <strong>{email}</strong>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="otp">Verification code</Label>
                    <Input
                      id="otp"
                      type="text"
                      placeholder="Enter 6-digit code"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      maxLength={6}
                      required
                      disabled={loading}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Verifying..." : "Verify & login"}
                  </Button>
                </form>

                <div className="text-center">
                  <Button
                    variant="link"
                    onClick={handleBackToEmail}
                    disabled={loading}
                  >
                    Back to email
                  </Button>
                </div>

                <div className="text-center text-sm text-gray-600">
                  Need an account?{" "}
                  <a href="/signup" className="text-blue-600 hover:underline">
                    Sign up here
                  </a>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SimpleLayout>
  );
}