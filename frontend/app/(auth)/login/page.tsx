import Link from "next/link";
import { linkClasses } from "@/components/Link";
import { lastSignInProvider } from "@/lib/auth";
import { AuthPage } from "..";

export default async function LoginPage() {
  const provider = (await lastSignInProvider.get()) ?? "";

  const description = {
    google: "You used Google to log in last time.",
    otp: "You used your work email last time.",
  }[provider];

  return (
    <AuthPage
      title="Welcome back"
      description={description || "Use your work email to log in."}
      ctaText="Log in"
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
