import React from "react";
import { linkClasses } from "@/components/Link";
import { cn } from "@/utils";

type LinkifyTextProps = { text: string; className?: string };

// Matches: http(s)://..., www...., and basic emails
const LINK_OR_EMAIL_REGEX = /((?:https?:\/\/|www\.)[^\s]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/gu;

function stripTrailingPunctuation(segment: string): { core: string; trailing: string } {
  let core = segment;
  let trailing = "";
  while (core.length > 0 && /[.,!?;:)\]}]+$/u.test(core)) {
    trailing = core.slice(-1) + trailing;
    core = core.slice(0, -1);
  }
  return { core, trailing };
}

export default function LinkifyText({ text, className }: LinkifyTextProps) {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = LINK_OR_EMAIL_REGEX.exec(text)) !== null) {
    const matched = match[0];
    const matchStart = match.index;
    const matchEnd = match.index + matched.length;

    if (matchStart > lastIndex) {
      nodes.push(text.slice(lastIndex, matchStart));
    }

    const { core, trailing } = stripTrailingPunctuation(matched);

    const isEmail = core.includes("@") && !/^https?:\/\//iu.test(core) && !/^www\./iu.test(core);
    const href = isEmail
      ? `mailto:${core}`
      : core.startsWith("www.")
        ? `https://${core}`
        : /^https?:\/\//iu.test(core)
          ? core
          : `https://${core}`;

    nodes.push(
      <a
        key={`link-${matchStart}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(linkClasses, "break-words print:text-black print:no-underline")}
      >
        {core}
      </a>,
    );

    if (trailing) nodes.push(trailing);
    lastIndex = matchEnd;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return <span className={className}>{nodes}</span>;
}
