"use client";

import { SignUp } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import SimpleLayout from "@/components/layouts/Simple";

export default function SignUpPage() {
  const searchParams = useSearchParams();
  const inviteId = searchParams.get("invite");

  const signUpProps = inviteId ? { unsafeMetadata: { contractorInviteUuid: inviteId } } : {};

  return (
    <SimpleLayout>
      <SignUp {...signUpProps} />
    </SimpleLayout>
  );
}
