"use client";

import React from "react";
import OnboardingHeader from "./header";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col">
      <OnboardingHeader />
      <div className="flex h-full flex-col">
        <main className="flex flex-1 flex-col items-center overflow-y-auto px-3 py-3">
          <div className="my-auto grid w-full max-w-md gap-4 print:my-0 print:max-w-full">
            <hgroup className="grid gap-2 text-center">
              <h1 className="text-3xl font-bold">Let's get to know you</h1>
              <p className="text-gray-500">
                We're eager to learn more about you, starting with your legal name and the place where you reside.
              </p>
            </hgroup>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
