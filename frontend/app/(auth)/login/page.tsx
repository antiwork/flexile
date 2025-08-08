"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { linkClasses } from "@/components/Link";
import { AuthPage } from "..";

export default function LoginPage() {
  const [description, setDescription] = useState<string>("");
  const [highlightedAuthMethod, setHighlightedAuthMethod] = useState<string>("google");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const method = localStorage.getItem("lastLoginMethod");

      if (!method) return;

      setHighlightedAuthMethod(method);
      if (method === "google") {
        setDescription("You used Google to log in last time.");
      } else if (method === "email") {
        setDescription("You used your work email to log in last time.");
      }
    }
  }, []);

  return (
    <AuthPage
      title="Welcome back"
      description={description}
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
      highlightedAuthMethod={highlightedAuthMethod}
    />
  );
}
