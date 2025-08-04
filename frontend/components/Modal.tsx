"use client";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export function Modal({ children, title }: { children: React.ReactNode; title: string }) {
  const router = useRouter();

  const handleOpenChange = () => {
    router.back();
  };

  return (
    <Dialog defaultOpen open onOpenChange={handleOpenChange}>
      <DialogContent className="!max-w-[calc(40%-2rem)]">
        <DialogTitle className="text-lg">{title}</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}
