"use client";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AuthAlerts } from "@/components/auth/AuthAlerts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useOtpFlowState } from "@/hooks/useOtpFlowState";
import logo from "@/public/logo-icon.svg";

function SignUpContent() {
  const searchParams = useSearchParams();
  const invitationToken = searchParams.get("invitation_token");

  const [state, actions] = useOtpFlowState();
  const { handleSendOtp, handleAuthenticate } = useAuthApi(
    {
      type: "signup",
      sendOtpEndpoint: "/api/signup-send-otp",
      ...(invitationToken && { invitationToken }),
    },
    state,
    actions,
  );

  return (
    <div className="flex items-center justify-center">
      <Card className="w-full max-w-md border-0 bg-transparent">
        <CardHeader className="text-center">
          <div className="mb-8 flex justify-center">
            <Image src={logo} alt="Flexile" className="size-16" />
          </div>
          <CardTitle className="pb-1 text-xl font-medium">
            {state.step === "email" ? "Create account" : "Check your email for a code"}
          </CardTitle>
          <CardDescription>
            {state.step === "email"
              ? "Sign up using the account you use at work."
              : "We’ve sent a 6-digit code to your email."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuthAlerts error={state.error} success={state.success} />

          {state.step === "email" ? (
            <form
              onSubmit={(e) => {
                void handleSendOtp(e);
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="email" className="block">
                  Work email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your work email..."
                  value={state.email}
                  onChange={(e) => actions.setEmail(e.target.value)}
                  required
                  disabled={state.loading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={state.loading}>
                {state.loading ? "Signing up..." : "Sign up"}
              </Button>

              <div className="pt-6 text-center text-sm text-gray-600">
                Already using Flexile?{" "}
                <Link href="/login" className="text-blue-600 hover:underline">
                  Log in
                </Link>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <form
                onSubmit={(e) => {
                  void handleAuthenticate(e);
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="otp" className="block">
                    Verification code
                  </Label>
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
                  {state.loading ? "Creating account..." : "Continue"}
                </Button>
              </form>

              <div className="text-center">
                <Button className="w-full" variant="outline" onClick={actions.backToEmail} disabled={state.loading}>
                  Back to email
                </Button>
              </div>

              <div className="pt-6 text-center text-sm text-gray-600">
                Already using Flexile?{" "}
                <Link href="/login" className="text-blue-600 hover:underline">
                  Log in
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignUpContent />
    </Suspense>
  );
}
