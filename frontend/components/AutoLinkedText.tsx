import { EditorContent, useEditor } from "@tiptap/react";
import React, { useEffect, useMemo } from "react";
import { richTextExtensions } from "@/utils/richText";

interface AutoLinkedTextProps {
  text: string;
  className?: string;
  /** Whether to preserve newlines and double spaces in the text */
  preserveWhitespace?: boolean;
}

/**
 * Component that automatically converts URLs and email addresses to clickable links.
 * Uses TipTap editor for rich text rendering with link support.
 */
const AutoLinkedText: React.FC<AutoLinkedTextProps> = ({ text, className, preserveWhitespace = false }) => {
  /**
   * Converts URLs and email addresses in text to clickable links.
   * First processes emails to avoid conflicts, then handles URLs while preserving existing links.
   */
  const linkifyText = (inputText: string): string => {
    if (!inputText) return "";

    let currentText = inputText;

    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/giu;
    currentText = currentText.replace(emailRegex, (match) => `<a href="mailto:${match}">${match}</a>`);

    const urlRegex = /(https?:\/\/[^\s<>"]+|www\.[^\s<>"]+|(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/[^\s<>"]*)?)/giu;

    // Split by existing anchor tags to avoid double-linking
    const parts = currentText.split(/(<a[^>]*>.*?<\/a>)/giu);

    return parts
      .map((part) => {
        if (/^<a[^>]*>.*?<\/a>$/iu.exec(part)) {
          return part;
        }
        return part.replace(urlRegex, (match) => {
          const href = match.startsWith("http") ? match : `https://${match}`;
          return `<a href="${href}" target="_blank" rel="noopener noreferrer">${match}</a>`;
        });
      })
      .join("");
  };

  const processedContent = useMemo(() => {
    if (!text) return "";

    let processedText = linkifyText(text);

    if (preserveWhitespace) {
      processedText = processedText.replace(/\n/gu, "<br>").replace(/ {2}/gu, " &nbsp;");
    }
    return `<p>${processedText}</p>`;
  }, [text, preserveWhitespace]);

  // TipTap editor in read-only mode with link extensions for proper rendering
  const editor = useEditor({
    extensions: richTextExtensions,
    content: processedContent,
    editable: false,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: `prose prose-sm max-w-none text-inherit ${className || ""}`.trim(),
      },
    },
  });

  useEffect(() => {
    if (editor && processedContent !== editor.getHTML()) {
      editor.commands.setContent(processedContent, false);
    }
  }, [processedContent, editor]);

  if (!text) {
    return null;
  }

  return (
    <div className="auto-linked-text">
      <EditorContent editor={editor} />
    </div>
  );
};

export default AutoLinkedText;
