"use client";
import Link from "next/link";
import { z } from "zod";
import { AuthPage } from "@/app/(auth)";
import { request } from "@/utils/request";

export default function SignUpPage() {
  return (
    <AuthPage
      title="Create account"
      description="Sign up using the account you use at work."
      sendOtpText="Sign up"
      switcher={
        <>
          Already using Flexile?{" "}
          <Link href="/login" className="text-blue-600 hover:underline">
            Log in
          </Link>
        </>
      }
      sendOtpUrl="/v1/signup/send_otp"
      onVerifyOtp={async (data) => {
        const response = await request({
          url: "/api/signup-verify",
          method: "POST",
          accept: "json",
          jsonData: {
            email: data.email,
            otp_code: data.otp,
          },
        });

        if (!response.ok) {
          throw new Error(
            z.object({ error: z.string() }).safeParse(await response.json()).data?.error || "Signup failed",
          );
        }
      }}
    />
  );
}
