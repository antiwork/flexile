import { SignUp } from "@clerk/nextjs";
import React from "react";
import SimpleLayout from "@/app/components/simple-layout";

export default function SignUpPage() {
  return (
    <SimpleLayout>
      <SignUp />
    </SimpleLayout>
  );
}
