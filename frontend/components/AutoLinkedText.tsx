import { EditorContent, useEditor } from "@tiptap/react";
import React, { useEffect, useMemo } from "react";
import { richTextExtensions } from "@/utils/richText";

interface AutoLinkedTextProps {
  text: string;
  className?: string;
  preserveWhitespace?: boolean;
}

const URL_REGEX =
  /(https?:\/\/[^\s<>"]+|www\.[^\s<>"]+|[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,})/giu;

/**
 * Component that automatically converts URLs to clickable links.
 * Uses TipTap editor for rich text rendering with link support.
 */
const AutoLinkedText: React.FC<AutoLinkedTextProps> = ({ text, className, preserveWhitespace = false }) => {
  const linkifyText = (inputText: string): string =>
    inputText.replace(URL_REGEX, (match) => {
      let href = match;
      if (match.startsWith("http")) {
        href = match;
      } else if (match.startsWith("www.")) {
        href = `https://${match}`;
      } else {
        href = `https://${match}`;
      }
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${match}</a>`;
    });

  const processedContent = useMemo(() => {
    if (!text) return "";

    let processedText = linkifyText(text);
    if (preserveWhitespace) {
      // Preserve whitespace: convert newlines to <br> and multiple spaces to &nbsp;
      processedText = processedText.replace(/\n/gu, "<br>").replace(/ {2}/gu, " &nbsp;");
    } else {
      // Trim whitespace: normalize multiple spaces and newlines
      processedText = processedText
        .replace(/\s+/gu, " ") // Replace multiple whitespace with single space
        .trim(); // Remove leading/trailing whitespace
    }
    return `<p>${processedText}</p>`;
  }, [text, preserveWhitespace]);

  const editor = useEditor({
    extensions: richTextExtensions,
    editable: false,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: `prose prose-sm max-w-none text-inherit ${className || ""}`.trim(),
      },
      handleClick: (_view, _pos, event) => {
        const target = event.target;
        return !(target instanceof HTMLElement && target.tagName === "A");
      },
    },
  });

  useEffect(() => {
    if (editor && processedContent) {
      editor.commands.setContent(processedContent);
    }
  }, [editor, processedContent]);

  if (!text) return null;

  return <EditorContent editor={editor} />;
};

export default AutoLinkedText;
