import React from "react";
import RichText from "@/components/RichText";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/global";

export default function SignForm({
  content,
  signed,
  onSign,
}: {
  content: string;
  signed: boolean;
  onSign: () => void;
}) {
  const user = useCurrentUser();
  return (
    <>
      <div className="border-muted my-2 max-h-100 overflow-y-auto rounded-md border px-8 py-4">
        <RichText content={content} />
      </div>
      <div className="grid gap-2">
        <h3>Your signature</h3>
        {signed ? (
          <div className="font-signature border-b text-xl">{user.legalName}</div>
        ) : (
          <Button className="border-muted w-full hover:border-current" variant="dashed" onClick={onSign}>
            Add your signature
          </Button>
        )}
        <div className="text-muted-foreground text-xs">
          By clicking the button above, you agree to using an electronic representation of your signature for all
          purposes within Flexile, just the same as a pen-and-paper signature.
        </div>
      </div>
    </>
  );
}
