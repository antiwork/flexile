import React from "react";

const URL_REGEX = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/giu;

export interface LinkifyProps {
  text: string;
  className?: string;
}

export function Linkify({ text, className }: LinkifyProps): React.ReactElement {
  if (!text) return <span />;

  const parts = text.split(URL_REGEX).filter(Boolean);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.match(URL_REGEX)) {
          const href = part.startsWith("www.") ? `https://${part}` : part;
          return (
            <a
              key={i}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline hover:text-blue-800"
            >
              {part}
            </a>
          );
        }
        return part;
      })}
    </span>
  );
}

export function useLinkify(text: string): React.ReactElement {
  return <Linkify text={text} />;
}
