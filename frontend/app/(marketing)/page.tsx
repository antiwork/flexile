"use client";

import { SignedIn, SignedOut } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { redirect, RedirectType } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { useUserStore } from "@/global";
import logo from "@/public/flexile-logo.svg";
import { cn } from "@/utils";
import iconClock from "./icon-clock.svg";
import iconDiamond from "./icon-diamond.svg";
import iconEye from "./icon-eye.svg";
import iconGlobe from "./icon-globe.svg";

const buttonClasses = "flex justify-center items-center rounded-full transition-all duration-400 no-underline";

const Section = ({ children, className }: { children: ReactNode; className?: string }) => (
  <section className={cn("flex", className)}>
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 md:gap-12">{children}</div>
  </section>
);

export default function HomePage() {
  const user = useUserStore((state) => state.user);
  useEffect(() => {
    if (user) throw redirect("/dashboard", RedirectType.replace);
  }, [user]);

  return (
    <>
      <nav className="fixed top-0 right-0 left-0 z-50 m-0 box-border flex h-20 w-full items-center justify-between bg-black p-0 text-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4">
          <Image src={logo} alt="Flexile" className="flex h-8 w-auto shrink-0 border-none invert md:block md:h-10" />
          <div className="flex gap-2">
            <SignedIn>
              <Link
                href="/dashboard"
                className={`${buttonClasses} h-10 bg-white px-8 text-sm text-black hover:bg-blue-600 hover:text-white md:h-12 md:text-base`}
              >
                Go to dashboard
              </Link>
            </SignedIn>
            <SignedOut>
              <Link
                href="/login/"
                className={`${buttonClasses} h-10 px-8 text-sm text-white hover:bg-white hover:text-black md:h-12 md:text-base`}
              >
                Login
              </Link>
              <Link
                href="/signup/"
                className={`${buttonClasses} h-10 bg-white px-8 text-sm text-black hover:bg-blue-600 hover:text-white md:h-12 md:text-base`}
              >
                Signup
              </Link>
            </SignedOut>
          </div>
        </div>
      </nav>

      <main className="min-h-screen bg-white pt-20">
        <Section className="bg-blue-600 py-8 md:py-16">
          <h1 className="text-6xl leading-[0.9] font-medium tracking-tight sm:text-8xl md:text-[12rem]">
            Contractor payments
          </h1>
          <div className="flex">
            <Link
              href="/signup/"
              className={`${buttonClasses} h-20 w-full bg-white px-8 text-xl text-black hover:bg-black hover:text-white md:h-28 md:text-2xl`}
            >
              Get started
            </Link>
          </div>
        </Section>

        <Section className="py-8 md:py-16">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-16">
            <div className="flex items-center gap-8">
              <Image src={iconClock} alt="Invoice Management" className="w-12 shrink-0" />
              <div>
                <h3 className="text-xl font-medium">Invoice Management</h3>
                <div className="text-xl text-gray-600">
                  Streamlined invoice creation, approval workflows, and automated processing
                </div>
              </div>
            </div>
            <div className="flex items-center gap-8">
              <Image src={iconGlobe} alt="Pay Contractors" className="w-12 shrink-0" />
              <div>
                <h3 className="text-xl font-medium">Pay Contractors</h3>
                <div className="text-xl text-gray-600">
                  Fast, reliable payments to contractors in 190+ countries worldwide
                </div>
              </div>
            </div>
            <div className="flex items-center gap-8">
              <Image src={iconEye} alt="Equity Option" className="w-12 shrink-0" />
              <div>
                <h3 className="text-xl font-medium">Equity Option</h3>
                <div className="text-xl text-gray-600">
                  Optional equity compensation for aligned contractor incentives
                </div>
              </div>
            </div>
            <div className="flex items-center gap-8">
              <Image src={iconDiamond} alt="Contract Management" className="w-12 shrink-0" />
              <div>
                <h3 className="text-xl font-medium">Contract Management</h3>
                <div className="text-xl text-gray-600">
                  Digital contract signing and automated contractor onboarding
                </div>
              </div>
            </div>
          </div>
        </Section>

        <Section className="flex bg-gray-50 py-8 md:py-16">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 md:gap-12">
            <h2 className="text-4xl font-medium md:text-6xl">Clear, straight forward pricing</h2>
            <div className="text-2xl md:text-3xl">1.5% + $0.50, capped at $15/payment</div>
          </div>
        </Section>

        <Section className="flex w-full bg-blue-600 py-8 md:py-16">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 md:gap-12">
            <h2 className="text-4xl font-medium md:text-6xl">Less stress, more flex</h2>
            <Link
              href="/signup/"
              className={`${buttonClasses} h-20 w-full bg-white px-8 text-xl text-black hover:bg-black hover:text-white md:h-28 md:text-2xl`}
            >
              Get started
            </Link>
          </div>
        </Section>

        <Section className="bg-black py-8 text-white md:py-16">
          <div className="mx-auto flex w-full max-w-5xl flex-col items-start justify-between px-4 md:flex-row md:items-end">
            <div className="flex flex-col items-start gap-8 md:gap-18">
              <Image src={logo} alt="Flexile" className="block h-16 w-auto invert" />
            </div>
            <div className="mt-8 flex flex-col items-start gap-4 text-left md:mt-0 md:items-end md:text-right">
              <Link href="/privacy" className="text-base text-white no-underline hover:underline">
                Privacy policy
              </Link>
              <Link href="/terms" className="text-base text-white no-underline hover:underline">
                Terms of service
              </Link>
            </div>
          </div>
        </Section>
      </main>
    </>
  );
}
