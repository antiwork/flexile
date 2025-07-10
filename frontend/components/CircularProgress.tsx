import React from "react";

export default function CircularProgress({ progress, radius = 8 }: { progress: number; radius?: number }) {
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = `${(progress / 100) * circumference} ${circumference}`;

  return (
    <svg className="h-4 w-4 -rotate-90" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r={radius} stroke="currentColor" strokeWidth="2" fill="none" className="text-gray-300" />
      <circle
        cx="10"
        cy="10"
        r={radius}
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeDasharray={strokeDasharray}
        className="text-blue-500"
      />
    </svg>
  );
}
