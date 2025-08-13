"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
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
                          disabled={sendOtp.isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <MutationStatusButton mutation={sendOtp} type="submit" className="w-full" loadingText="Sending...">
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
