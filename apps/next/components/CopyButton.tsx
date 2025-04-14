import { CheckIcon } from "@heroicons/react/16/solid";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";

const CopyButton = ({
  copyText,
  children,
  ...props
}: {
  copyText: string;
  children: React.ReactNode;
} & React.ComponentProps<typeof Button>) => {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard.writeText(copyText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Button onClick={copy} {...props}>
      {copied ? (
        <>
          <CheckIcon className="size-4" /> Copied!
        </>
      ) : (
        children
      )}
    </Button>
  );
};

export default CopyButton;
