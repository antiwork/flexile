"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { linkClasses } from "@/components/Link";
import { LoginMethod } from "@/db/enums";
import { AuthPage } from "..";

export const loginMethodLabels: Record<LoginMethod, string> = {
  [LoginMethod.Email]: "your work email",
  [LoginMethod.Google]: "Google",
};

export default function LoginPage() {
  const [lastLoginMethod, setLastLoginMethod] = useState<LoginMethod | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const method = localStorage.getItem("lastLoginMethod");

      if (!method) return;

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      setLastLoginMethod(method as LoginMethod);
    }
  }, []);

  return (
    <AuthPage
      title="Welcome back"
      description={
        lastLoginMethod
          ? `You used ${loginMethodLabels[lastLoginMethod]} to log in last time.`
          : "Use your work email to log in."
      }
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
