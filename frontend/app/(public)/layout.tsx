import Image from "next/image";
import React from "react";
import logo from "@/images/flexile-logo.svg";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col print:block">
      <header className="flex w-full items-center justify-center bg-black p-6 text-white print:hidden">
        <a href="https://flexile.com/" className="invert" rel="noopener noreferrer">
          <Image src={logo} alt="Flexile" />
        </a>
      </header>
      <main className="flex flex-1 flex-col items-center overflow-y-auto px-3 py-3 print:overflow-visible">
        <div className="my-auto grid gap-4 pt-7">{children}</div>
      </main>
    </div>
  );
}
