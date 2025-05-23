import React from "react";
import SimpleLayout from "@/app/components/simple-layout";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return <SimpleLayout>{children}</SimpleLayout>;
}
