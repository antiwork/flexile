import { DocusealForm } from "@docuseal/react";
import type React from "react";
import { useCurrentUser } from "@/global";

export default function Form(props: React.ComponentProps<typeof DocusealForm>) {
  const user = useCurrentUser();

  return (
    <DocusealForm
      email={user.email}
      expand={false}
      sendCopyEmail={false}
      withTitle={false}
      withSendCopyButton={false}
      {...props}
    />
  );
}
