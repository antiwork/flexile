"use client";

import React from "react";
import PublicLayoutHeader from "./header";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <PublicLayoutHeader />
      <main className="flex flex-1 flex-col items-center overflow-y-auto px-3 py-3">
        <div className="my-auto grid w-full max-w-md gap-4 pt-7 print:my-0 print:max-w-full">{children}</div>
      </main>
    </div>
  );
}
