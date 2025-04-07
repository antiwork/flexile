import { SignUp } from "@clerk/nextjs";
import SimpleLayout from "@/components/layouts/Simple";
import React from "react";

export default function SignUpPage() {
  return (
    <SimpleLayout>
      <SignUp />
    </SimpleLayout>
  );
}
