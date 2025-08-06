"use client";
import Link from "next/link";
import { AuthPage } from "..";

export default function LoginPage() {
  return (
    <AuthPage
      title="Welcome back"
      description="Use your work email to log in."
      switcher={
        <>
          Don't have an account?{" "}
          <Link href="/signup" className="text-blue-600 hover:underline">
            Sign up
          </Link>
        </>
      }
      sendOtpUrl="/internal/email_otp"
    />
  );
}
