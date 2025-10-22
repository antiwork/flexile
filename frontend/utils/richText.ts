import { Link } from "@tiptap/extension-link";
import { TextAlign } from "@tiptap/extension-text-align";
import { Underline } from "@tiptap/extension-underline";
import { StarterKit } from "@tiptap/starter-kit";
import { find } from "linkifyjs";
import { createElement, Fragment } from "react";
import type { ReactNode } from "react";
import { linkClasses } from "@/components/Link";

export const richTextExtensions = [
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  StarterKit.configure({ listItem: { HTMLAttributes: { class: "[&>p]:inline" } } }),
  Link.configure({ defaultProtocol: "https" }),
  Underline,
];

export const linkifyLineItemText = (text: string): ReactNode => {
  if (!text.trim()) return "";

  const matches = find(text, { defaultProtocol: "https" });
  if (!matches.length) return text;

  const parts: ReactNode[] = [];
  let cursor = 0;

  matches.forEach((match, index) => {
    if (match.start > cursor) {
      parts.push(text.slice(cursor, match.start));
    }

    if (match.type === "email") {
      parts.push(match.value);
    } else {
      parts.push(
        createElement(
          "a",
          {
            key: `${match.href}-${index}`,
            href: match.href,
            className: linkClasses,
            rel: "noreferrer noopener",
            target: "_blank",
          },
          match.value,
        ),
      );
    }

    cursor = match.end;
  });

  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return createElement(Fragment, null, ...parts);
};
