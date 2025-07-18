import Image from "next/image";
import React from "react";
import logo from "@/images/flexile-logo.svg";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <header className="flex w-full items-center justify-center bg-black p-6 text-white print:hidden">
        <a href="https://flexile.com/" className="invert" rel="noopener noreferrer">
          <Image src={logo} alt="Flexile" />
        </a>
      </header>
      <main className="flex flex-1 flex-col items-center overflow-y-auto px-3 py-3">
        <div className="my-auto grid w-full max-w-md gap-4 pt-7 print:my-0 print:max-w-full">{children}</div>
      </main>
    </div>
  );
}
