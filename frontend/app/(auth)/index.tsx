"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { getSession, signIn } from "next-auth/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { MutationStatusButton } from "@/components/MutationButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { SignInMethod } from "@/db/enums";
import googleLogoLight from "@/images/google-light.svg";
import logo from "@/public/logo-icon.svg";
import { request } from "@/utils/request";

const emailSchema = z.object({ email: z.string().email() });
const otpSchema = z.object({
  otp: z.string().length(6, "Please enter the 6-digit verification code"),
});

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  Callback: "Access denied or an unexpected error occurred.",
  AccessDenied: "You do not have permission to perform this action.",
  Verification: "Invalid or expired verification link.",
};

export function AuthPage({
  title,
  description,
  switcher,
  sendOtpUrl,
  sendOtpText,
  onVerifyOtp,
}: {
  title: string;
  description: string;
  switcher: React.ReactNode;
  sendOtpUrl: string;
  sendOtpText: string;
  onVerifyOtp?: (data: { email: string; otp: string }) => Promise<void>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oauthError = searchParams.get("error");
  const [redirectInProgress, setRedirectInProgress] = useState(false);
  const sendOtp = useMutation({
    mutationFn: async (values: { email: string }) => {
      const response = await request({
        url: sendOtpUrl,
        method: "POST",
        accept: "json",
        jsonData: values,
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

      const redirectUrl = searchParams.get("redirect_url");
      setRedirectInProgress(true);
      router.replace(
        // @ts-expect-error - Next currently does not allow checking this at runtime - the leading / ensures this is safe
        redirectUrl && redirectUrl.startsWith("/") && !redirectUrl.startsWith("//") ? redirectUrl : "/dashboard",
      );
    },
  });
  const emailForm = useForm({
    resolver: zodResolver(emailSchema),
  });
  const submitEmailForm = emailForm.handleSubmit(async (values) => {
    try {
      await sendOtp.mutateAsync(values);
      localStorage.setItem("last_sign_in_method", SignInMethod.Email);
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

  const providerSignIn = (provider: SignInMethod) => {
    localStorage.setItem("last_sign_in_method", provider);
    const redirectUrlParam = searchParams.get("redirect_url");
    const redirectUrl =
      redirectUrlParam && redirectUrlParam.startsWith("/") && !redirectUrlParam.startsWith("//")
        ? redirectUrlParam
        : "/dashboard";
    void signIn(provider, { callbackUrl: redirectUrl });
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
                            // Filter out non-numeric characters
                            const numericValue = value.replace(/[^0-9]/gu, "");
                            field.onChange(numericValue);
                            if (numericValue.length === 6) setTimeout(() => void submitOtpForm(), 100);
                          }}
                          aria-label="Verification code"
                          disabled={verifyOtp.isPending || redirectInProgress}
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
                      {/* Reserve space for error message to prevent layout shift */}
                      <div className="min-h-5 text-center text-sm">
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />
                <div className="text-center">
                  {verifyOtp.isPending || redirectInProgress ? (
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
                      Verifying your code...
                    </div>
                  ) : (
                    <Button className="text-gray-600" variant="link" onClick={() => sendOtp.reset()}>
                      Back to email
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          ) : null}
          {!sendOtp.isSuccess ? (
            <Form {...emailForm}>
              <form onSubmit={(e) => void submitEmailForm(e)} className="space-y-4">
                <div className="mb-4 flex flex-col items-center">
                  {oauthError ? (
                    <p className="text-destructive mb-2">
                      {Object.prototype.hasOwnProperty.call(OAUTH_ERROR_MESSAGES, oauthError)
                        ? OAUTH_ERROR_MESSAGES[oauthError]
                        : oauthError}
                    </p>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    className="font-base flex h-11 w-full items-center justify-center gap-2 border-none bg-blue-600 text-base text-white hover:bg-blue-500"
                    onClick={() => providerSignIn(SignInMethod.Google)}
                  >
                    <Image src={googleLogoLight} alt="Google" width={20} height={20} />
                    {sendOtpText} with Google
                  </Button>
                  <div className="my-3 flex w-full items-center gap-2">
                    <div className="bg-muted h-px flex-1" />
                    <span className="text-muted-foreground text-sm">or</span>
                    <div className="bg-muted h-px flex-1" />
                  </div>
                </div>
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
                          style={{ height: "42px" }}
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
                  className="border-input hover:border-input hover:bg-accent w-full bg-white text-gray-900"
                  loadingText="Sending..."
                >
                  {sendOtpText}
                </MutationStatusButton>

                <div className="pt-6 text-center text-gray-600">{switcher}</div>
              </form>
            </Form>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
