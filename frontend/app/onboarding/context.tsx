"use client";

import React, { createContext, useContext } from "react";

type OnboardingContextType = {
  steps?: string[] | undefined;
  stepIndex?: number | undefined;
  title?: string | undefined;
  subtitle?: string | React.ReactNode | undefined;
};

const OnboardingContext = createContext<OnboardingContextType>({});

export function OnboardingProvider({
  children,
  steps,
  stepIndex,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  steps?: string[];
  stepIndex?: number;
  title?: string;
  subtitle?: string | React.ReactNode;
}) {
  return (
    <OnboardingContext.Provider value={{ steps, stepIndex, title, subtitle }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  return useContext(OnboardingContext);
}
