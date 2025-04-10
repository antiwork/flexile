import { SignIn } from "@clerk/nextjs";
import React from "react";
import SimpleLayout from "@/components/layouts/Simple";

export default function Login() {
  return (
    <SimpleLayout hideHeader>
      <SignIn signUpUrl="/signup" transferable={false} />
    </SimpleLayout>
  );
}
