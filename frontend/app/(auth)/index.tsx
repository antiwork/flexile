"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Route } from "next";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { getSession, signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { MutationStatusButton } from "@/components/MutationButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import logo from "@/public/logo-icon.svg";
import { request } from "@/utils/request";

const emailSchema = z.object({ email: z.string().email() });
const otpSchema = z.object({ otp: z.string().length(6) });

export function AuthPage({
  title,
  description,
  switcher,
  sendOtpUrl,
  sendOtpText,
  onVerifyOtp,
  googleButtonText = "Log in with Google",
}: {
  title: string;
  description: string;
  switcher: React.ReactNode;
  sendOtpUrl: string;
  sendOtpText: string;
  onVerifyOtp?: (data: { email: string; otp: string }) => Promise<void>;
  googleButtonText?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invitationToken = searchParams.get("invitation_token");
  const queryClient = useQueryClient();

  const googleSignIn = useMutation({
    mutationFn: async () => {
      const redirectUrl =
        typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("redirect_url") : null;
      const callbackUrl =
        redirectUrl && redirectUrl.startsWith("/") && !redirectUrl.startsWith("//") ? redirectUrl : "/dashboard";

      const result = await signIn("google", { callbackUrl });
      if (result?.error) throw new Error("Google sign-in failed");
    },
  });
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
      const userEmail = session.user.email;
      await queryClient.resetQueries({ queryKey: ["currentUser", userEmail] });

      const redirectUrl =
        typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("redirect_url") : null;
      const nextHref =
        redirectUrl && redirectUrl.startsWith("/") && !redirectUrl.startsWith("//") ? redirectUrl : "/dashboard";
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- dynamic redirect URL validation
      router.replace(nextHref as Route);
    },
  });
  const emailForm = useForm({
    resolver: zodResolver(emailSchema),
    disabled: sendOtp.isPending,
  });
  const submitEmailForm = emailForm.handleSubmit(async (values) => {
    try {
      await sendOtp.mutateAsync(values);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to send verification code";
      emailForm.setError("email", {
        message: errorMessage,
      });
    }
  });

  const otpForm = useForm({
    resolver: zodResolver(otpSchema),
    disabled: verifyOtp.isPending,
  });
  const submitOtpForm = otpForm.handleSubmit(async (values) => {
    try {
      await verifyOtp.mutateAsync(values);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to verify OTP";
      otpForm.setError("otp", { message: errorMessage });
    }
  });

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
                  loadingText={
                    <div className="flex items-center justify-center space-x-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                      <span>Verifying...</span>
                    </div>
                  }
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
            <>
              <div className="space-y-6">
                <MutationStatusButton
                  mutation={googleSignIn}
                  onClick={() => void googleSignIn.mutateAsync()}
                  className="h-12 w-full rounded-lg bg-blue-600 px-4 font-medium text-white shadow-sm transition-all duration-200 hover:bg-blue-700"
                  loadingText={
                    <div className="flex items-center justify-center space-x-3">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-300 border-t-white" />
                      <span>signing in...</span>
                    </div>
                  }
                >
                  <div className="flex items-center justify-center space-x-3">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 18 18"
                      className="flex-shrink-0"
                    >
                      <path
                        fill="white"
                        fillRule="evenodd"
                        d="M18 9.205q-.002-.957-.167-1.841h-8.65v3.481h4.943c-.213 1.125-.86 2.078-1.832 2.717v2.258h2.968C16.998 14.253 18 11.946 18 9.205"
                        clipRule="evenodd"
                      />
                      <path
                        fill="white"
                        fillRule="evenodd"
                        d="M9.184 18c2.48 0 4.558-.806 6.078-2.18l-2.968-2.258c-.823.54-1.875.859-3.11.859-2.392 0-4.417-1.584-5.139-3.71H.977v2.331C2.488 15.983 5.594 18 9.184 18"
                        clipRule="evenodd"
                      />
                      <path
                        fill="white"
                        fillRule="evenodd"
                        d="M4.045 10.71A5.3 5.3 0 0 1 3.757 9c0-.593.104-1.17.288-1.71V4.958H.977a8.85 8.85 0 0 0 0 8.084z"
                        clipRule="evenodd"
                      />
                      <path
                        fill="white"
                        fillRule="evenodd"
                        d="M9.184 3.58c1.348 0 2.559.454 3.51 1.346l2.634-2.582C13.738.892 11.66 0 9.184 0 5.594 0 2.488 2.017.977 4.958L4.045 7.29c.722-2.127 2.747-3.71 5.139-3.71"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>{googleButtonText}</span>
                  </div>
                </MutationStatusButton>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="bg-gray-50 px-4 font-medium text-gray-500">or</span>
                  </div>
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
                            className="bg-white"
                            required
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <MutationStatusButton
                    mutation={sendOtp}
                    type="submit"
                    className="w-full"
                    loadingText={
                      <div className="flex items-center justify-center space-x-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                        <span>Signing in...</span>
                      </div>
                    }
                  >
                    {sendOtpText}
                  </MutationStatusButton>

                  <div className="pt-6 text-center text-gray-600">{switcher}</div>
                </form>
              </Form>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
