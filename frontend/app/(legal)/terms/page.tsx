import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils";

const sections = [
  "Definitions",
  "Services",
  "Restrictions",
  "Relationship with Gumroad",
  "Accounts",
  "Ownership",
  "Investigations",
  "Interactions with other users",
  "Fees",
  "Confidential information",
  "No solicitation",
  "Non-Circumvention",
  "Indemnification",
  "Disclaimer of warranties",
  "Limitation of liability",
  "Term and termination",
  "Release",
  "Dispute resolution",
  "Construction",
  "General provisions",
];

export default function Terms() {
  return (
    <div className="prose mx-auto max-w-3xl p-6">
      <h1>Terms of Service Agreement</h1>
      <p>
        This Terms of Service Agreement ("<strong>Agreement</strong>") is for Customers and Contractors (defined
        below) ("<strong>You</strong>" as applicable), and governs Your use of the Flexile platform (the "
        <strong>Platform</strong>"), which provides managed services for companies ("<strong>Customers</strong>")
        engaging independent, professional contractors ("<strong>Contractors</strong>") to provide services for them.
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
      {/* Rest of terms content */}
    </div>
  );
}
