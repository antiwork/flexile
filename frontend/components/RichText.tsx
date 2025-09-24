import type { Content } from "@tiptap/core";
import { EditorContent, isList, useEditor } from "@tiptap/react";
import { Bold, Heading, Italic, Link, List, Underline } from "lucide-react";
import React, { useEffect, useState } from "react";
import { linkClasses } from "@/components/Link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/utils";
import { richTextExtensions } from "@/utils/richText";

const RichText = ({ content, className }: { content: Content; className?: string }) => {
  const editor = useEditor({
    extensions: richTextExtensions,
    content,
    editorProps: {
      attributes: {
        class: cn(className, "prose"),
      },
    },
    editable: false,
    immediatelyRender: false,
  });

  useEffect(() => void editor?.commands.setContent(content, false), [content]);

  return (
    <div>
      <EditorContent editor={editor} />
    </div>
  );
};

export const Editor = ({
  value,
  onChange,
  className,
  id,
  "aria-label": ariaLabel,
  ...props
}: {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  className?: string;
} & Omit<React.ComponentProps<"div">, "onChange">) => {
  const [addingLink, setAddingLink] = useState<{ url: string } | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);

  const editor = useEditor({
    extensions: richTextExtensions,
    content: value ?? "",
    editable: true,
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? null : editor.getHTML()),
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
        class: cn(className, "prose p-4 min-h-60 max-h-96 overflow-y-auto max-w-full rounded-b-md outline-none"),
      },
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value ?? "", false);
    }
  }, [value, editor]);

  const currentLink: unknown = editor?.getAttributes("link").href;

  const toolbarItems = [
    { label: "Bold", name: "bold", icon: Bold },
    { label: "Italic", name: "italic", icon: Italic },
    { label: "Underline", name: "underline", icon: Underline },
    { label: "Heading", name: "heading", attributes: { level: 2 }, icon: Heading },
    {
      label: "Link",
      name: "link",
      icon: Link,
      onClick: () => {
        setAddingLink({ url: typeof currentLink === "string" ? currentLink : "" });
        setUrlError(null);
      },
    },
    { label: "Bullet list", name: "bulletList", icon: List },
  ];
  const onToolbarClick = (item: (typeof toolbarItems)[number]) => {
    if (!editor) return;
    if (item.onClick) return item.onClick();
    const commands = editor.chain().focus();
    const type = editor.extensionManager.extensions.find((extension) => extension.name === item.name)?.type;
    if (type === "mark") commands.toggleMark(item.name, item.attributes);
    else if (isList(item.name, editor.extensionManager.extensions))
      commands.toggleList(item.name, "listItem", false, item.attributes);
    else commands.toggleNode(item.name, "paragraph", item.attributes);
    commands.run();
  };

  const normalizeUrl = (url: string): string => {
    // If already has http:// or https://, return as is
    if (/^https?:\/\//u.exec(url)) {
      return url;
    }
    // If it looks like a domain/URL, add https://
    if (url.includes(".") || url.startsWith("www.")) {
      return `https://${url}`;
    }
    return url;
  };

  const isValidUrl = (url: string): boolean => {
    try {
      const normalizedUrl = normalizeUrl(url);
      const urlObj = new URL(normalizedUrl);

      return ["http:", "https:"].includes(urlObj.protocol);
    } catch {
      return false;
    }
  };

  const handleInsertLink = () => {
    if (!addingLink?.url) return;

    if (!isValidUrl(addingLink.url)) {
      setUrlError("Please enter a valid URL");
      return;
    }

    setUrlError(null);
    const normalizedUrl = normalizeUrl(addingLink.url);
    editor?.chain().focus().extendMarkRange("link").setLink({ href: normalizedUrl }).run();
    setAddingLink(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleInsertLink();
    }
  };

  return (
    <div
      {...props}
      className={cn(
        "group border-input rounded-md border bg-transparent transition-[color,box-shadow] outline-none",
        "focus-within:ring-ring/15 focus-within:border-gray-300 focus-within:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className,
      )}
    >
      <div className="border-input group-aria-invalid:border-destructive flex border-b">
        {toolbarItems.map((item) => (
          <button
            type="button"
            className={cn(linkClasses, "p-3 text-sm")}
            key={item.label}
            aria-label={item.label}
            aria-pressed={editor?.isActive(item.name, item.attributes)}
            onClick={() => onToolbarClick(item)}
          >
            <item.icon className="size-5" />
          </button>
        ))}
      </div>
      {editor ? <EditorContent editor={editor} /> : null}
      <Dialog
        open={!!addingLink}
        onOpenChange={() => {
          setAddingLink(null);
          setUrlError(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insert Link</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="link-url">URL</Label>
            <Input
              id="link-url"
              value={addingLink?.url ?? ""}
              onChange={(e) => {
                setAddingLink({ url: e.target.value });
                setUrlError(null);
              }}
              onKeyDown={handleKeyDown}
              type="url"
              placeholder="https://example.com"
              required
              className={urlError ? "border-destructive" : ""}
            />
            {urlError ? <p className="text-destructive mt-1 text-sm">{urlError}</p> : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                editor?.chain().focus().unsetLink().run();
                setAddingLink(null);
                setUrlError(null);
              }}
            >
              {currentLink ? "Unlink" : "Cancel"}
            </Button>
            <Button type="submit" onClick={handleInsertLink}>
              Insert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RichText;
