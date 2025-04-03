"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import Footer from "@/components/Footer";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { HIRING_LOCATIONS, type LOCATION_TYPES } from "@/models/constants";
import {
  DEFAULT_EQUITY_HOURLY_RANGE,
  DEFAULT_VESTING_PERIOD,
  type JOB_POSITION,
  JOB_POSITIONS,
} from "@/models/jobListings";

// Component for displaying job compensation
const JobCompensation = ({ label, compensation, equity }: { label: string; compensation: string; equity: string }) => (
  <div>
    <div className="flex flex-row">
      <p className="text-md mr-2 font-light">{label} -</p>
      <p className="font-medium text-gray-900">{compensation}</p>
    </div>
    <p className={`mt-${label === "Full-time" ? "0.5 mb-3" : "1"} text-sm font-medium text-blue-600`}>
      {label === "Full-time"
        ? `+${equity} equity over ${DEFAULT_VESTING_PERIOD}`
        : `take ${DEFAULT_EQUITY_HOURLY_RANGE} of this as equity`}
    </p>
  </div>
);

// Job card component for cleaner rendering
const JobCard = ({ position }: { position: JOB_POSITION }) => (
  <Link
    href={position.href}
    className="group block rounded-lg border border-gray-200 px-6 py-4 transition-colors hover:border-blue-500 hover:bg-blue-50"
  >
    <div className="flex items-center justify-between">
      <div className="space-y-1">
        <h2 className="text-xl font-medium">{position.title}</h2>
        <p className="text-sm text-gray-600">
          {position.location === HIRING_LOCATIONS.REMOTE ? "Remote" : "In-person (New York)"}
        </p>
        <JobCompensation
          label="Full-time"
          compensation={position.compensationFullTime}
          equity={position.equityFullTime}
        />
        <JobCompensation
          label="Hourly"
          compensation={position.compensationHourly}
          equity={position.equityHourly || DEFAULT_EQUITY_HOURLY_RANGE}
        />
      </div>
      <ArrowRight className="h-6 w-6 text-gray-400 transition-colors group-hover:text-blue-500" />
    </div>
  </Link>
);

export default function JobListings() {
  const [workLocation, setWorkLocation] = useState<LOCATION_TYPES>(HIRING_LOCATIONS.REMOTE);
  const filteredPositions = JOB_POSITIONS.filter((position: JOB_POSITION) => position.location === workLocation);

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
          {/* Work Location Filter */}
          <div className="w-full">
            <RadioGroup
              defaultValue={HIRING_LOCATIONS.REMOTE}
              className="flex flex-row items-baseline justify-center gap-x-12"
              onValueChange={(value: LOCATION_TYPES) => setWorkLocation(value)}
            >
              <div className="order-first flex items-center space-x-2 sm:order-last">
                <RadioGroupItem value={HIRING_LOCATIONS.IN_PERSON} id="in-person" className="cursor-pointer" />
                <Label htmlFor="in-person" className="cursor-pointer font-medium text-nowrap">
                  In-person (New York)
                </Label>
              </div>
              <div className="order-last flex items-center space-x-2 sm:order-first">
                <RadioGroupItem value={HIRING_LOCATIONS.REMOTE} id="remote" className="cursor-pointer" />
                <Label htmlFor="remote" className="cursor-pointer font-medium">
                  Remote
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        {/* Job Listings */}
        <div className="space-y-4">
          {filteredPositions.map((position: JOB_POSITION) => (
            <JobCard key={position.title} position={position} />
          ))}
        </div>

        {/* Powered by Footer */}
        <div className="flex items-center justify-center space-x-2 pt-8 text-gray-500">
          <Footer />
        </div>
      </div>
    </div>
  );
}
