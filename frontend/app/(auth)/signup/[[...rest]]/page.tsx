"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthAlerts } from "@/components/auth/AuthAlerts";
import { useOtpFlowState } from "@/hooks/useOtpFlowState";
import { useAuthApi } from "@/hooks/useAuthApi";

export default function SignUpPage() {
  const searchParams = useSearchParams();
  const invitationToken = searchParams.get("invitation_token");

  const [state, actions] = useOtpFlowState();
  const { handleSendOtp, handleAuthenticate } = useAuthApi(
    {
      type: "signup",
      sendOtpEndpoint: "/api/signup-send-otp",
      invitationToken: invitationToken || undefined,
    },
    state,
    actions
  );

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>
            {state.step === "email"
              ? "Enter your email address to receive a verification code"
              : "Enter the 6-digit code sent to your email"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuthAlerts error={state.error} success={state.success} />

          {state.step === "email" ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={state.email}
                  onChange={(e) => actions.setEmail(e.target.value)}
                  required
                  disabled={state.loading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={state.loading}>
                {state.loading ? "Sending..." : "Send verification code"}
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <form onSubmit={handleAuthenticate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="otp">Verification code</Label>
                  <Input
                    id="otp"
                    type="text"
                    placeholder="Enter 6-digit code"
                    value={state.otp}
                    onChange={(e) => actions.setOtp(e.target.value)}
                    maxLength={6}
                    required
                    disabled={state.loading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={state.loading}>
                  {state.loading ? "Creating account..." : "Create account"}
                </Button>
              </form>

              <div className="text-center">
                <Button variant="link" onClick={actions.backToEmail} disabled={state.loading}>
                  Back to email
                </Button>
              </div>

              <div className="text-center text-sm text-gray-600">
                Already have an account?{" "}
                <Link href="/login" className="text-blue-600 hover:underline">
                  Sign in here
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
