import { SignIn } from "@clerk/nextjs";
import React from "react";

export default function Login() {
  return <SignIn signUpUrl="/signup" transferable={false} />;
}
