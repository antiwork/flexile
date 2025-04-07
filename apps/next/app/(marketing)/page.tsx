"use client";

import { SignedIn, SignedOut } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import logo from "@/public/flexile-logo.svg";
import { cn } from "@/utils";
import equityAllocation from "./equity-allocation.png";
import equityCapTable from "./equity-cap-table.png";
import equityEmail from "./equity-email.png";
import featuresInvoice from "./features-invoice.gif";
import featuresOnboarding from "./features-onboarding.gif";
import iconClock from "./icon-clock.svg";
import iconDiamond from "./icon-diamond.svg";
import iconEye from "./icon-eye.svg";
import iconGlobe from "./icon-globe.svg";
import testimonialKarin from "./testimonial-karin.jpg";
import testimonialSahil from "./testimonial-sahil.jpg";
import testimonialSid from "./testimonial-sid.jpg";
import type { ReactNode } from "react";
import { useState } from "react";

const buttonClasses = "flex justify-center items-center rounded-full transition-all duration-400 no-underline";

const Section = ({ children, className }: { children: ReactNode; className?: string }) => (
  <section className={cn("flex", className)}>
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 md:gap-12">{children}</div>
  </section>
);

const BulletPoint = ({ children }: { children: ReactNode }) => (
  <div className="flex items-start justify-start gap-4">
    <div className="mt-1 h-3 w-3 shrink-0 bg-white"></div>
    <div>{children}</div>
  </div>
);

export default function HomePage() {
  const equityTabs = [
    { label: "Connect your cap table", image: equityCapTable },
    { label: "Pick your equity model", image: equityAllocation },
    { label: "Send dividends at scale", image: equityEmail },
  ];
  const [currentEquityTab, setCurrentEquityTab] = useState(0);
  const testimonials = [
    {
      name: "Sid Yadav",
      image: testimonialSid,
      title: "CEO of Circle.so",
      quote:
        "Most entrepreneurs have two options: work a full-time job and hustle nights/weekends, or leave your job and risk everything. Flexile offers a third way.",
    },
    {
      name: "Sahil Lavingia",
      image: testimonialSahil,
      title: "CEO of Gumroad",
      quote:
        "Gumroad was the original testing ground for Flexile. Instead of prioritizing growth, we're prioritizing people, and the growth comes naturally instead of toxically.",
    },
    {
      name: "Karin Fyhrie",
      image: testimonialKarin,
      title: "CEO, Sovereign Objects",
      quote:
        "Flexile helps me to operationalize the time to stay inspired. As a creative lead, that's incredibly important not only to me, but also my team.",
    },
  ];

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
        <Section className="bg-blue-600 py-16">
          <h1 className="text-[84px] leading-[0.9] font-medium tracking-tight sm:text-8xl md:text-[12rem]">
            Payroll &amp;
            <br />
            equity for
            <br />
            everyone
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

        <section className="flex bg-black">
          <video autoPlay loop muted playsInline className="block w-full">
            <source src="/home-flex-os.mp4" type="video/mp4" />
          </video>
        </section>

        <Section className="py-16">
          <h2 className="text-5xl font-medium md:text-8xl">
            The tools and talent <br />
            to run lean
          </h2>
          <div className="text-2xl md:text-3xl">
            Flexile helps you onboard and pay qualified remote contractors to help you grow your business
            cost-effectively.
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-16">
            <div className="flex items-center gap-8">
              <Image src={iconEye} alt="Find Flex Workers" className="w-12 shrink-0" />
              <div>
                <h3 className="text-xl font-medium">Find Flex Workers</h3>
                <div className="text-xl text-gray-600">
                  Work with top talent screened for <br />
                  expertise + part-time availability
                </div>
              </div>
            </div>
            <div className="flex items-center gap-8">
              <Image src={iconClock} alt="Automate Operations" className="w-12 shrink-0" />
              <div>
                <h3 className="text-xl font-medium">Automate Operations</h3>
                <div className="text-xl text-gray-600">
                  Onboard in seconds, track status <br />
                  async, and streamline invoicing
                </div>
              </div>
            </div>
            <div className="flex items-center gap-8">
              <Image src={iconGlobe} alt="Pay Globally" className="w-12 shrink-0" />
              <div>
                <h3 className="text-xl font-medium">Pay Globally</h3>
                <div className="text-xl text-gray-600">
                  Make unlimited, international <br />
                  payments to 190+ countries
                </div>
              </div>
            </div>
            <div className="flex items-center gap-8">
              <Image src={iconDiamond} alt="Offer Equity" className="w-12 shrink-0" />
              <div>
                <h3 className="text-xl font-medium">Offer Equity</h3>
                <div className="text-xl text-gray-600">
                  Retain contract talent with a <br />
                  mix of cash, equity, and/or dividends
                </div>
              </div>
            </div>
          </div>
        </Section>

        <Section className="bg-black py-16 text-white">
          <div className="flex flex-col gap-16">
            <div className="flex flex-col gap-12 md:flex-row md:gap-16">
              <div className="w-full overflow-hidden rounded-lg md:w-1/2">
                <Image src={featuresOnboarding} alt="Onboarding demo" className="block w-full object-cover" />
              </div>
              <div className="w-full md:w-1/2">
                <div className="flex flex-col gap-4 md:gap-8">
                  <h3 className="text-3xl font-medium md:text-4xl">Find and onboard flex teams compliantly.</h3>
                  <div className="flex flex-col gap-4">
                    <BulletPoint>
                      Build an end-to-end team by the hour. Roles span design, engineering, internal ops, customer
                      support, and more.
                    </BulletPoint>
                    <BulletPoint>
                      Access our freelance talent network, vetted for quality product chops and experience serving
                      millions of users
                    </BulletPoint>
                    <BulletPoint>Automate and store freelancer banking details and payment preferences</BulletPoint>
                    <BulletPoint>Sign and archive contracts inline</BulletPoint>
                    <BulletPoint>Amend and send automated ICAs tailored to regulations in 190+ countries</BulletPoint>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-12 md:flex-row md:gap-16">
              <div className="w-full overflow-hidden rounded-lg md:w-1/2">
                <Image src={featuresInvoice} alt="Invoice demo" className="block w-full object-cover" />
              </div>
              <div className="w-full md:w-1/2">
                <div className="flex flex-col gap-4 md:gap-8">
                  <h3 className="text-3xl font-medium md:text-4xl">Oversee timesheets and invoicing.</h3>
                  <div className="flex flex-col gap-4">
                    <BulletPoint>Capture, cap, and track weekly work with built-in timesheets</BulletPoint>
                    <BulletPoint>
                      No more PDF invoices — get teams to instantly generate them within Flexile
                    </BulletPoint>
                    <BulletPoint>Review, reject, or approve invoices in 1-click</BulletPoint>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Section>

        <section className="flex bg-white py-16">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 md:gap-12">
            <h2 className="text-5xl font-medium md:text-8xl">Equity-align your team</h2>
            <div className="text-2xl md:text-3xl">Help your people pick their perfect % with equity splits.</div>
            <div className="flex flex-col gap-6">
              <div className="flex justify-center gap-2" role="tablist" aria-label="Equity Tabs">
                {equityTabs.map((tab, index) => (
                  <button
                    key={index}
                    type="button"
                    role="tab"
                    aria-selected={currentEquityTab === index}
                    className="flex cursor-pointer flex-col items-center justify-center gap-2 text-xs tracking-wide uppercase md:flex-row md:text-base"
                    onClick={() => setCurrentEquityTab(index)}
                  >
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full border border-solid border-black",
                        { "bg-green text-white": currentEquityTab === index },
                      )}
                    >
                      {index + 1}
                    </div>
                    {tab.label}
                    {index < 2 ? (
                      <div className="hidden h-0.5 w-8 border-t-0 border-r-0 border-b border-l-0 border-dashed border-black md:block"></div>
                    ) : null}
                  </button>
                ))}
              </div>
              <div className="overflow-hidden rounded-xl border border-solid border-black">
                {equityTabs.map((tab, index) => (
                  <div
                    key={index}
                    role="tabpanel"
                    aria-labelledby={`tab-${tab.label}`}
                    className="w-full"
                    hidden={currentEquityTab !== index}
                  >
                    <Image src={tab.image} alt={tab.label} width={1200} height={800} className="w-full" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="flex bg-gray-50 py-16">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 md:gap-12">
            <h2 className="text-5xl font-medium md:text-8xl">Clear, straight forward pricing</h2>
            <div className="text-2xl md:text-3xl">1.5% + $0.50, capped at $15/payment</div>
          </div>
        </section>

        <section className="flex bg-black py-16 text-white">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 md:flex-row md:gap-8">
            {testimonials.map((testimonial, index) => (
              <div className="flex flex-col items-center gap-4 text-center" key={index}>
                <Image src={testimonial.image} alt={testimonial.name} className="block w-56 rounded-lg" />
                <div>
                  <div className="text-xl font-medium">{testimonial.name}</div>
                  <div className="text-md text-muted_white">{testimonial.title}</div>
                </div>
                <div className="text-lg">“{testimonial.quote}”</div>
              </div>
            ))}
          </div>
        </section>

        <section className="flex w-full bg-blue-600 py-16">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 md:gap-12">
            <h2 className="text-5xl font-medium md:text-8xl">Less stress, more flex</h2>
            <Link
              href="/signup/"
              className={`${buttonClasses} h-20 w-full bg-white px-8 text-xl text-black hover:bg-black hover:text-white md:h-28 md:text-2xl`}
            >
              Get started
            </Link>
          </div>
        </section>

        <section className="flex w-full bg-black py-16 text-white">
          <div className="mx-auto flex w-full max-w-5xl flex-col items-start justify-between px-4 md:flex-row md:items-end">
            <div className="flex flex-col items-start gap-8 md:gap-18">
              <a href="#" className="text-base text-white no-underline hover:underline">
                Back to top ↑
              </a>
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
        </section>
      </main>
    </>
  );
}
