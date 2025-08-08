"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { linkClasses } from "@/components/Link";
import { AuthPage } from "..";

export default function LoginPage() {
  const [description, setDescription] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const lastLoginMethod = localStorage.getItem("lastLoginMethod");
      if (lastLoginMethod === "google") {
        setDescription("You used Google to log in last time.");
      } else if (lastLoginMethod === "email") {
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
    />
  );
}
