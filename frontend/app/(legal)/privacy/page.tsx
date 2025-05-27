import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils";

const sections = [
  "Personal information we collect",
  "How we use your personal information",
  "How we share your personal information",
  "Your choices",
  "Other sites and services",
  "Security",
  "International data transfer",
  "Children",
  "Changes to this Privacy Policy",
  "How to contact us",
];

export default function Privacy() {
  return (
    <div className="prose mx-auto max-w-3xl p-6">
      <h1>Privacy Policy</h1>
      <p>Effective as of May 9, 2022.</p>
      <p>
        This Privacy Policy describes how Gumroad, Inc. ("<strong>Flexile</strong>," "<strong>we</strong>", "
        <strong>us</strong>" or "<strong>our</strong>") handles personal information that we collect through our
        digital properties that link to this Privacy Policy, including the Flexile website (collectively, the "
        <strong>Service</strong>"), as well as through other activities described in this Privacy Policy.
      </p>
      <div role="navigation" className={cn("grid gap-1", "not-prose")}>
        {sections.map((section, index) => (
          <a key={index} href={`#jump_${index + 1}`} className="flex items-center text-gray-500 no-underline">
            <Badge variant="outline" className="mr-1 shrink-0">
              {index + 1}
            </Badge>
            <span className="truncate">{section}</span>
          </a>
        ))}
      </div>
      {/* Rest of privacy content */}
    </div>
  );
}
