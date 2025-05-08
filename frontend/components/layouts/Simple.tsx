import Image from "next/image";
import React from "react";
import logo from "@/images/flexile-logo.svg";

interface SimpleLayoutProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  hideHeader?: boolean;
  children: React.ReactNode;
}

const Simple = ({ title, subtitle, hideHeader, children }: SimpleLayoutProps) => (
  <div className="flex h-full flex-col">
    {!hideHeader && (
      <header className="flex w-full items-center justify-center bg-black p-6 text-white print:hidden">
        <a href="https://flexile.com/" className="invert">
          <Image src={logo} alt="Flexile" />
        </a>
      </header>
    )}
    <main className="flex flex-1 flex-col items-center overflow-y-auto px-3 py-3">
      <div className="my-auto grid w-full max-w-md gap-4 print:my-0 print:max-w-full">
        <hgroup className="grid gap-2 text-center">
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="text-gray-500">{subtitle}</p>
        </hgroup>
        {children}
      </div>
    </main>
  </div>
);

export default Simple;
