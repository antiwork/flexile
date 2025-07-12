"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { useCurrentUser } from "@/global";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import logo from "@/images/flexile-logo.svg";
import { SignOutButton } from "@clerk/nextjs";
import { CheckIcon } from "@heroicons/react/16/solid";
import { steps } from ".";

export default function OnboardingHeader() {
  const user = useCurrentUser();
  const stepIndex = 1;
  return (
    <header className="grid w-full items-center justify-center bg-black p-6 text-white md:grid-cols-[1fr_auto_1fr]">
      <Link
        href="https://flexile.com/"
        className={`hidden text-4xl invert md:block ${steps.length === 0 ? "col-start-2" : ""}`}
      >
        <Image src={logo} alt="Flexile" />
      </Link>
      {steps.length > 0 && (
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
        Signing up as {user?.email}.{" "}
        <SignOutButton>
          <Button variant="link">Logout</Button>
        </SignOutButton>
      </div>
    </header>
  );
}
