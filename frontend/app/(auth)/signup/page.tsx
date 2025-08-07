"use client";
import Link from "next/link";
import { z } from "zod";
import { linkClasses } from "@/components/Link";
import { request } from "@/utils/request";
import { AuthPage } from "..";

export default function SignUpPage() {
  return (
    <AuthPage
      title="Create account"
      description="Sign up using the account you use at work."
      sendOtpText="Sign up"
      switcher={
        <>
          Already using Flexile?{" "}
          <Link href="/login" className={linkClasses}>
            Log in
          </Link>
        </>
      }
      sendOtpUrl="/internal/signup/send_otp"
      onVerifyOtp={async (data) => {
        const response = await request({
          url: "/internal/signup/verify_and_create",
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
