"use client";

import React from "react";
import logo from "@/images/flexile-logo.svg";
import Image from "next/image";
import { usePathname } from "next/navigation";

export default function PublicLayoutHeader() {
  const pathname = usePathname();
  const showTopNav = pathname?.startsWith("/login") || pathname?.startsWith("/signup");
  return (
    <>
      {!showTopNav && (
        <header className="flex w-full items-center justify-center bg-black p-6 text-white print:hidden">
          <a href="https://flexile.com/" className="invert">
            <Image src={logo} alt="Flexile" />
          </a>
        </header>
      )}
    </>
  );
}
