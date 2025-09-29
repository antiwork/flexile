import Image from "next/image";
import React from "react";
import logo from "@/images/flexile-logo.svg";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col print:block">
      <header className="bg-secondary border-sidebar-border flex w-full items-center justify-center border-b p-6 print:hidden">
        <a href="https://flexile.com/" className="dark:invert" rel="noopener noreferrer">
          <Image src={logo} alt="Flexile" />
        </a>
      </header>
      <main className="bg-secondary flex flex-1 flex-col items-center overflow-y-auto px-3 py-3 print:overflow-visible">
        <div className="my-auto grid gap-4 pt-7">{children}</div>
      </main>
    </div>
  );
}
