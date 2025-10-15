import { EditorContent, useEditor } from "@tiptap/react";
import React, { useEffect, useMemo } from "react";
import { richTextExtensions } from "@/utils/richText";

interface AutoLinkedTextProps {
  text: string;
  className?: string;
  /** Whether to preserve newlines and double spaces in the text */
  preserveWhitespace?: boolean;
}

// URL regex that matches URLs
const URL_REGEX = /(https?:\/\/[^\s<>"]+|www\.[^\s<>"]+)/giu;

/**
 * Component that automatically converts URLs to clickable links.
 * Uses TipTap editor for rich text rendering with link support.
 */
const AutoLinkedText: React.FC<AutoLinkedTextProps> = ({ text, className, preserveWhitespace = false }) => {
  const linkifyText = (inputText: string): string =>
    inputText.replace(URL_REGEX, (match) => {
      const href = match.startsWith("http") ? match : `https://${match}`;
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${match}</a>`;
    });

  const processedContent = useMemo(() => {
    if (!text) return "";

    let processedText = linkifyText(text);
    if (preserveWhitespace) {
      processedText = processedText.replace(/\n/gu, "<br>").replace(/ {2}/gu, " &nbsp;");
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
        // Allow links to be clickable in read-only mode
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
