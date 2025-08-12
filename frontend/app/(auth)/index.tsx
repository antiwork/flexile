"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { getSession, signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { MutationStatusButton } from "@/components/MutationButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import logo from "@/public/logo-icon.svg";
import { cn } from "@/utils";
import { request } from "@/utils/request";

const emailSchema = z.object({ email: z.string().email() });
const otpSchema = z.object({ otp: z.string().length(6) });

const getRedirectUrl = () => {
  const redirectUrl =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("redirect_url") : null;
  return redirectUrl && redirectUrl.startsWith("/") && !redirectUrl.startsWith("//") ? redirectUrl : "/dashboard";
};

const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" className="size-6">
    <path
      fill="currentColor"
      d="M11.999 4.51a7.486 7.486 0 0 0-7.5 7.5c0 4.165 3.358 7.5 7.5 7.5 3.596 0 7.492-2.855 7.5-7.546v-1.453h-7.5v3h4.195c-.62 1.741-2.24 3-4.195 3a4.5 4.5 0 1 1 0-9c1.054 0 2.032.353 2.787.968.245-.245 1.713-1.718 2.188-2.098-1.322-1.185-3.052-1.87-4.975-1.87"
    />
  </svg>
);

const GitHubIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" className="size-5">
    <path
      fill="currentColor"
      d="M12 0C5.374 0 0 5.373 0 12 0 17.302 3.438 21.8 8.207 23.387c.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"
    />
  </svg>
);

export function AuthPage({
  title,
  description,
  switcher,
  sendOtpUrl,
  sendOtpText,
  onVerifyOtp,
  isSignup,
}: {
  title: string;
  description: string;
  switcher: React.ReactNode;
  sendOtpUrl: string;
  sendOtpText: string;
  onVerifyOtp?: (data: { email: string; otp: string }) => Promise<void>;
  isSignup?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invitationToken = searchParams.get("invitation_token");
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [errorProvider, setErrorProvider] = useState<string | null>(localStorage.getItem("lastLoginMethod"));

  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam) {
      setOauthError(errorParam);
    }
  }, [searchParams, router]);

  const queryClient = useQueryClient();
  const sendOtp = useMutation({
    mutationFn: async (values: { email: string }) => {
      const response = await request({
        url: sendOtpUrl,
        method: "POST",
        accept: "json",
        jsonData: { ...values, invitation_token: invitationToken },
      });

      if (!response.ok) {
        throw new Error(
          z.object({ error: z.string() }).safeParse(await response.json()).data?.error ||
            "Failed to send verification code",
        );
      }
    },
  });

  const verifyOtp = useMutation({
    mutationFn: async (values: { otp: string }) => {
      const email = emailForm.getValues("email");
      await onVerifyOtp?.({ email, otp: values.otp });

      const result = await signIn("otp", { email, otp: values.otp, redirect: false });

      if (result?.error) throw new Error("Invalid verification code");

      const session = await getSession();
      if (!session?.user.email) throw new Error("Invalid verification code");
      await queryClient.resetQueries({ queryKey: ["currentUser", session.user.email] });

      localStorage.setItem("lastLoginMethod", "email");
      // @ts-expect-error - Next currently does not allow checking this at runtime - the leading / ensures this is safe
      router.replace(getRedirectUrl());
    },
  });
  const emailForm = useForm({
    resolver: zodResolver(emailSchema),
  });
  const submitEmailForm = emailForm.handleSubmit(async (values) => {
    try {
      await sendOtp.mutateAsync(values);
    } catch (error) {
      emailForm.setError("email", {
        message: error instanceof Error ? error.message : "Failed to send verification code",
      });
    }
  });

  const otpForm = useForm({
    resolver: zodResolver(otpSchema),
  });
  const submitOtpForm = otpForm.handleSubmit(async (values) => {
    try {
      await verifyOtp.mutateAsync(values);
    } catch (error) {
      otpForm.setError("otp", { message: error instanceof Error ? error.message : "Failed to verify OTP" });
    }
  });

  const handleGoogleAuth = async () => {
    setOauthError(null);
    setErrorProvider(null);
    const context = isSignup ? "signup" : "login";
    document.cookie = `auth_context=${context}; path=/; max-age=300; Secure; SameSite=Strict`;

    if (invitationToken) {
      document.cookie = `auth_invitation_token=${invitationToken}; path=/; max-age=300; Secure; SameSite=Strict`;
    }

    try {
      await signIn("google", { callbackUrl: getRedirectUrl() });
      localStorage.setItem("lastLoginMethod", "google");
    } catch (error) {
      setOauthError(error instanceof Error ? error.message : "Failed to continue with Google");
      setErrorProvider("google");
    }
  };

  const handleGitHubAuth = async () => {
    setOauthError(null);
    setErrorProvider(null);
    const context = isSignup ? "signup" : "login";
    document.cookie = `auth_context=${context}; path=/; max-age=300; Secure; SameSite=Strict`;

    if (invitationToken) {
      document.cookie = `auth_invitation_token=${invitationToken}; path=/; max-age=300; Secure; SameSite=Strict`;
    }

    try {
      await signIn("github", { callbackUrl: getRedirectUrl() });
      localStorage.setItem("lastLoginMethod", "github");
    } catch (error) {
      setOauthError(error instanceof Error ? error.message : "Failed to continue with GitHub");
      setErrorProvider("github");
    }
  };

  return (
    <div className="flex items-center justify-center">
      <Card className="w-full max-w-md border-0 bg-transparent">
        <CardHeader className="text-center">
          <div className="mb-8 flex justify-center">
            <Image src={logo} alt="Flexile" className="size-16" />
          </div>
          <CardTitle className="pb-1 text-xl font-medium">
            {sendOtp.isSuccess ? "Check your email for a code" : title}
          </CardTitle>
          <CardDescription>
            {sendOtp.isSuccess ? "We’ve sent a 6-digit code to your email." : description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sendOtp.isSuccess ? (
            <Form {...otpForm}>
              <form onSubmit={(e) => void submitOtpForm(e)} className="flex flex-col items-center space-y-4">
                <FormField
                  control={otpForm.control}
                  name="otp"
                  render={({ field }) => (
                    <FormItem className="justify-items-center">
                      <FormControl>
                        <InputOTP
                          {...field}
                          maxLength={6}
                          onChange={(value) => {
                            field.onChange(value);
                            if (value.length === 6) setTimeout(() => void submitOtpForm(), 100);
                          }}
                          aria-label="Verification code"
                          disabled={verifyOtp.isPending}
                          autoFocus
                          required
                        >
                          <InputOTPGroup>
                            <InputOTPSlot index={0} />
                            <InputOTPSlot index={1} />
                            <InputOTPSlot index={2} />
                          </InputOTPGroup>
                          <InputOTPGroup>
                            <InputOTPSlot index={3} />
                            <InputOTPSlot index={4} />
                            <InputOTPSlot index={5} />
                          </InputOTPGroup>
                        </InputOTP>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <MutationStatusButton
                  mutation={verifyOtp}
                  type="submit"
                  className="w-[342px]"
                  loadingText="Verifying..."
                >
                  Continue
                </MutationStatusButton>
                <div className="pt-6 text-center">
                  <Button
                    className="text-gray-600"
                    variant="link"
                    onClick={() => sendOtp.reset()}
                    disabled={verifyOtp.isPending}
                  >
                    Back to email
                  </Button>
                </div>
              </form>
            </Form>
          ) : null}
          {!sendOtp.isSuccess ? (
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1 space-y-2">
                  <Button
                    type="button"
                    variant="primary"
                    className={cn(
                      `flex h-12 w-full items-center justify-center gap-2 text-sm`,
                      oauthError && errorProvider === "google" && "border-destructive",
                    )}
                    onClick={() => void handleGoogleAuth()}
                    disabled={sendOtp.isPending}
                  >
                    <div className="size-6 text-white">
                      <GoogleIcon />
                    </div>
                    {isSignup ? "Sign up with Google" : "Log in with Google"}
                  </Button>
                  {oauthError && errorProvider === "google" ? (
                    <p className="text-destructive text-sm">{oauthError}</p>
                  ) : null}
                </div>
                <div className="flex-1 space-y-2">
                  <Button
                    type="button"
                    variant="default"
                    className={cn(
                      `flex h-12 w-full items-center justify-center gap-2 text-sm`,
                      oauthError && errorProvider === "github" && "border-destructive",
                    )}
                    onClick={() => void handleGitHubAuth()}
                    disabled={sendOtp.isPending}
                  >
                    <div className="flex size-6 items-center justify-center text-white">
                      <GitHubIcon />
                    </div>
                    {isSignup ? "Sign up with GitHub" : "Log in with GitHub"}
                  </Button>
                  {oauthError && errorProvider === "github" ? (
                    <p className="text-destructive text-sm">{oauthError}</p>
                  ) : null}
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="h-px w-full bg-[rgba(29,30,23,0.18)]" />
                </div>
                <div className="relative flex justify-center text-base">
                  <span className="bg-[#F8F8F8] px-3">or</span>
                </div>
              </div>

              <Form {...emailForm}>
                <form onSubmit={(e) => void submitEmailForm(e)} className="space-y-4">
                  <FormField
                    control={emailForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Work email</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="email"
                            placeholder="Enter your work email..."
                            className="bg-white text-sm placeholder:text-gray-400"
                            required
                            disabled={sendOtp.isPending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <MutationStatusButton
                    mutation={sendOtp}
                    type="submit"
                    idleVariant="outline"
                    className="h-12 w-full bg-white text-sm"
                    loadingText="Sending..."
                  >
                    {sendOtpText}
                  </MutationStatusButton>

                  <div className="pt-6 text-center text-gray-600">{switcher}</div>
                </form>
              </Form>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
