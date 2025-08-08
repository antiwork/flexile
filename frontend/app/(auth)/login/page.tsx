"use client";
import Link from "next/link";
import { linkClasses } from "@/components/Link";
import { AuthPage } from "..";

export default function LoginPage() {
  return (
    <AuthPage
      title="Welcome back"
      description="Use your work email to log in."
      sendOtpText="Log in"
      switcher={
        <>
          Don't have an account?{" "}
          <Link href="/signup" className={linkClasses}>
            Sign up
          </Link>
        </>
      }
      sendOtpUrl="/internal/email_otp"
    />
  );
}
