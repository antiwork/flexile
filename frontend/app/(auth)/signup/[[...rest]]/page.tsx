import { SignUp } from "@clerk/nextjs";
import React from "react";
import SimpleLayout from "@/components/layouts/Simple";

export default function SignUpPage() {
  return (
    <SimpleLayout>
      <SignUp />
    </SimpleLayout>
  );
}
