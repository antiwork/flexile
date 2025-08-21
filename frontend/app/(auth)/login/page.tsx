"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { linkClasses } from "@/components/Link";
import { SignInMethod } from "@/db/enums";
import { AuthPage } from "..";

const signInMethodLabels: Record<SignInMethod, string> = {
  [SignInMethod.Email]: "your work email",
  [SignInMethod.Google]: "Google",
};

export default function LoginPage() {
  const [lastSignInMethod, setLastSignInMethod] = useState<SignInMethod | null>(null);

  const isValidSignInMethod = (method: string | null): method is SignInMethod =>
    Object.values(SignInMethod).some((validMethod) => validMethod === method);

  useEffect(() => {
    const lastMethod = localStorage.getItem("last_sign_in_method");
    if (lastMethod && isValidSignInMethod(lastMethod)) {
      setLastSignInMethod(lastMethod);
    }
  }, []);

  return (
    <AuthPage
      title="Welcome back"
      description={
        lastSignInMethod
          ? `You used ${signInMethodLabels[lastSignInMethod]} to log in last time.`
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
