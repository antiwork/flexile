"use client";

import { SignOutButton } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import React from "react";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/global";
import SimpleLayout from "@/app/components/simple-layout";

const logoSrc = "/images/flexile-logo.svg";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = useCurrentUser();

  return (
    <div className="flex h-screen flex-col">
      <header className="grid w-full items-center justify-center bg-black p-6 text-white md:grid-cols-[1fr_auto_1fr]">
        <Link
          href="https://flexile.com/"
          className="hidden text-4xl invert md:block"
        >
          <Image src={logoSrc} alt="Flexile" />
        </Link>
        <div className="hidden justify-self-end text-sm md:block">
          Signing up as {user.email}.{" "}
          <SignOutButton>
            <Button variant="link" className="text-white">
              Logout
            </Button>
          </SignOutButton>
        </div>
      </header>
      <SimpleLayout hideHeader>
        {children}
      </SimpleLayout>
    </div>
  );
}
