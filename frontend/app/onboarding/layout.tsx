"use client";

import { SignOutButton } from "@clerk/nextjs";
import { CheckIcon } from "@heroicons/react/16/solid";
import Image from "next/image";
import Link from "next/link";
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/global";
import SimpleLayout from "@/app/components/simple-layout";
import { useOnboarding } from "./context";

const logoSrc = "/images/flexile-logo.svg";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = useCurrentUser();
  const { steps, stepIndex, title, subtitle } = useOnboarding();

  return (
    <div className="flex h-screen flex-col">
      <header className="grid w-full items-center justify-center bg-black p-6 text-white md:grid-cols-[1fr_auto_1fr]">
        <Link
          href="https://flexile.com/"
          className={`hidden text-4xl invert md:block ${steps?.length === 0 ? "col-start-2" : ""}`}
        >
          <Image src={logoSrc} alt="Flexile" />
        </Link>
        {steps && steps.length > 0 && stepIndex !== undefined && (
          <ol className="flex list-none justify-center gap-2">
            {steps.map((name, index) => (
              <li key={name} className="flex items-center gap-2">
                <Badge variant={index <= stepIndex ? "default" : "outline"}>
                  {index < stepIndex ? <CheckIcon /> : <span>{index + 1}</span>}
                </Badge>
                <span className="name hidden md:inline">{name}</span>
                {index < steps.length - 1 && <span className="text-xs">----</span>}
              </li>
            ))}
          </ol>
        )}
        <div className="hidden justify-self-end text-sm md:block">
          Signing up as {user.email}.{" "}
          <SignOutButton>
            <Button variant="link" className="text-white">
              Logout
            </Button>
          </SignOutButton>
        </div>
      </header>
      <SimpleLayout hideHeader title={title} subtitle={subtitle}>
        {children}
      </SimpleLayout>
    </div>
  );
}
