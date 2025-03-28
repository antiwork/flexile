"use client";

import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface JobPosition {
  title: string;
  href: string;
  location: "remote" | "in-person";
  compensationFullTime: string;
  compensationHourly: string;
  equityFullTime: string;
  vestingPeriod: string;
  equityHourly: string;
}

const positions: JobPosition[] = [
  {
    title: "Senior software engineer",
    href: "/jobs/senior-software-engineer",
    location: "remote",
    compensationFullTime: "$150K - $250K per year",
    compensationHourly: "$100 - $150 per hour",
    equityFullTime: "0.5% - 1.0%",
    vestingPeriod: "4 years",
    equityHourly: "20% - 80%",
  },
  {
    title: "Design engineer",
    href: "/jobs/design-engineer",
    location: "in-person",
    compensationFullTime: "$130K - $200K per year",
    compensationHourly: "$80 - $120 per hour",
    equityFullTime: "0.3% - 0.7%",
    vestingPeriod: "4 years",
    equityHourly: "20% - 80%",
  },
  {
    title: "Staff engineer",
    href: "/jobs/staff-engineer",
    location: "remote",
    compensationFullTime: "$180K - $280K per year",
    compensationHourly: "$120 - $180 per hour",
    equityFullTime: "0.7% - 1.2%",
    vestingPeriod: "4 years",
    equityHourly: "20% - 80%",
  },
  {
    title: "Senior product designer",
    href: "/jobs/senior-product-designer",
    location: "in-person",
    compensationFullTime: "$140K - $220K per year",
    compensationHourly: "$90 - $140 per hour",
    equityFullTime: "0.4% - 0.8%",
    vestingPeriod: "4 years",
    equityHourly: "20% - 80%",
  },
];

export default function JobListings() {
  const [workLocation, setWorkLocation] = useState<"remote" | "in-person">("remote");

  const filteredPositions = positions.filter((position) => position.location === workLocation);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl space-y-8">
        {/* Logo */}
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-lg bg-blue-400">
            <div className="flex h-full items-center justify-center">
              <div className="h-6 w-6 text-blue-700">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 7l5 5-5 5m5-10l5 5-5 5" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-center text-4xl font-bold tracking-tight">Job openings at Antiwork</h1>

        {/* Filters Container */}
        <div className="mx-auto flex w-full flex-col justify-between space-y-4 sm:w-[61%] sm:flex-row sm:space-y-0 sm:space-x-4">
          {/* Employment Type Filter */}

          {/* Work Location Filter */}
          <div className="w-full sm:w-1/2">
            <RadioGroup
              defaultValue="remote"
              className="flex flex-col space-y-2"
              onValueChange={(value) => setWorkLocation(value)}
            >
              <div className="order-first flex items-center space-x-2 sm:order-last">
                <RadioGroupItem value="in-person" id="in-person" />
                <Label htmlFor="in-person" className="font-medium">
                  In-person (New York)
                </Label>
              </div>
              <div className="order-last flex items-center space-x-2 sm:order-first">
                <RadioGroupItem value="remote" id="remote" />
                <Label htmlFor="remote" className="font-medium">
                  Remote
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        {/* Job Listings */}
        <div className="space-y-4">
          {filteredPositions.map((position) => (
            <Link
              key={position.title}
              href={position.href}
              className="group block rounded-lg border border-gray-200 px-6 py-4 transition-colors hover:border-blue-500 hover:bg-blue-50"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h2 className="text-xl font-medium">{position.title}</h2>
                  <p className="text-sm text-gray-600">
                    {position.location === "remote" ? "Remote" : "In-person (New York)"}
                  </p>
                  <div>
                    <div className="flex flex-row">
                      <p className="text-md mr-2 font-light">Full-time - </p>
                      <p className="font-medium text-gray-900">{position.compensationFullTime}</p>
                    </div>
                    <p className="mt-0.5 mb-3 text-sm font-medium text-blue-600">{`+${position.equityFullTime}`}</p>
                    <div className="flex flex-row">
                      <p className="text-md mr-2 font-light">Hourly -</p>
                      <p className="font-medium text-gray-900">{position.compensationHourly}</p>
                    </div>
                    <p className="mt-1 text-sm font-medium text-blue-600">
                      {`take ${position.equityHourly} of this as equity`}
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-6 w-6 text-gray-400 transition-colors group-hover:text-blue-500" />
              </div>
            </Link>
          ))}
        </div>

        {/* Powered by Footer */}
        <div className="flex items-center justify-center space-x-2 pt-8 text-gray-500">
          <span>POWERED BY</span>
          <Image
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-81FXAbhmaiAvpzYRYUALQkUTYrIjtw.png"
            alt="Flexile Logo"
            width={80}
            height={24}
            className="h-6 w-auto"
          />
        </div>
      </div>
    </div>
  );
}
