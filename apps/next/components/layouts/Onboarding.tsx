"use client";

import { SignOutButton } from "@clerk/nextjs";
import { CheckIcon } from "@heroicons/react/16/solid";
import Image from "next/image";
import Link from "next/link";
import React from "react";
import { Badge } from "@/components/ui/badge";
import Button from "@/components/Button";
import { useCurrentUser } from "@/global";
import logo from "@/images/flexile-logo.svg";
import SimpleLayout from "./Simple";

const OnboardingLayout = ({
  steps,
  stepIndex,
  title,
  subtitle,
  children,
}: {
  steps: string[];
  stepIndex: number;
  title: string;
  subtitle?: string | React.ReactNode;
  children: React.ReactNode;
}) => {
  const user = useCurrentUser();

  return (
    <div className="flex h-screen flex-col">
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
          Signing up as {user.email}.{" "}
          <SignOutButton>
            <Button variant="link">Logout</Button>
          </SignOutButton>
        </div>
      </header>
      <SimpleLayout hideHeader title={title} subtitle={subtitle}>
        {children}
      </SimpleLayout>
    </div>
  );
};

export default OnboardingLayout;
