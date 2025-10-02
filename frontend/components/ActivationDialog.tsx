"use client";

import { Info } from "lucide-react";
import Link from "next/link";
import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { linkClasses } from "@/components/Link";

export interface ActivationDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  missingRequirements: {
    type: 'bank' | 'tax' | 'contract';
    message: string;
    actionText: string;
    actionHref: string;
  }[];
}

/**
 * Dialog that shows when user tries to perform an action but lacks required setup
 * Provides deep-links to complete the missing requirements
 */
export function ActivationDialog({
  open,
  onClose,
  title,
  description,
  missingRequirements,
}: ActivationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-gray-600">{description}</p>

          <div className="space-y-3">
            {missingRequirements.map((requirement, index) => (
              <Alert key={index} className="border-orange-200 bg-orange-50">
                <Info className="size-4 text-orange-600" />
                <AlertDescription className="text-orange-800">
                  {requirement.message}{" "}
                  <Link
                    href={requirement.actionHref as any}
                    className={linkClasses}
                    onClick={onClose}
                  >
                    {requirement.actionText}
                  </Link>
                </AlertDescription>
              </Alert>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Got it
          </Button>
          {missingRequirements.length === 1 && (
            <Button asChild>
              <Link href={missingRequirements[0].actionHref} onClick={onClose}>
                {missingRequirements[0].actionText}
              </Link>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


