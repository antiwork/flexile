import { DocusealForm } from "@docuseal/react";
import { useCurrentUser } from "@/global";
import type React from "react";

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
