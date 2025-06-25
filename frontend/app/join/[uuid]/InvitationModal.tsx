"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface InvitationModalProps {
  companyName: string;
  companyLogo?: string | undefined;
  inviterName: string;
}

export function InvitationModal({ companyName, companyLogo, inviterName }: InvitationModalProps) {
  return (
    <Dialog open>
      <DialogContent>
        {companyLogo ? (
          <Image src={companyLogo} alt={`${companyName} logo`} width={64} height={64} className="rounded-full" />
        ) : null}

        <DialogHeader>
          <DialogTitle>
            {inviterName} invited you to join {companyName}
          </DialogTitle>
          <DialogDescription>
            Get started as a contractor with {companyName}. You'll be able to submit invoices, track your work, and get
            paid quickly.
          </DialogDescription>
        </DialogHeader>

        <Link href="/signup">
          <Button className="w-full">Accept invitation</Button>
        </Link>
      </DialogContent>
    </Dialog>
  );
}
