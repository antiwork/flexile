import { Bars2Icon, BoldIcon, ItalicIcon, LinkIcon, ListBulletIcon, UnderlineIcon } from "@heroicons/react/24/outline";
import type { Content } from "@tiptap/core";
import { EditorContent, isList, useEditor } from "@tiptap/react";
import React, { useEffect, useState } from "react";
import { linkClasses } from "@/components/Link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/utils";
import { richTextExtensions } from "@/utils/richText";

const RichText = ({ content }: { content: Content }) => {
  const editor = useEditor({
    extensions: richTextExtensions,
    content,
    editorProps: { attributes: { class: "prose" } },
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
  ...props
}: {
  value: string | null;
  onChange: (value: string) => void;
  className?: string;
} & React.ComponentProps<"div">) => {
  const [addingLink, setAddingLink] = useState<{ url: string } | null>(null);
  const id = React.useId();

  const editor = useEditor({
    extensions: richTextExtensions,
    content: value,
    editable: true,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        id,
        class: cn(className, "prose p-4 min-h-60 max-h-96 overflow-y-auto max-w-full rounded-b-md outline-none"),
      },
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, false);
    }
  }, [value, editor]);

  const currentLink: unknown = editor?.getAttributes("link").href;

  const toolbarItems = [
    { label: "Bold", name: "bold", icon: BoldIcon },
    { label: "Italic", name: "italic", icon: ItalicIcon },
    { label: "Underline", name: "underline", icon: UnderlineIcon },
    { label: "Heading", name: "heading", attributes: { level: 2 }, icon: Bars2Icon },
    {
      label: "Link",
      name: "link",
      icon: LinkIcon,
      onClick: () => setAddingLink({ url: typeof currentLink === "string" ? currentLink : "" }),
    },
    { label: "Bullet list", name: "bulletList", icon: ListBulletIcon },
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

  return (
    <div
      {...props}
      className={cn(
        "group border-input rounded-md border bg-transparent transition-[color,box-shadow] outline-none",
        "focus-within:border-ring focus-within:ring-ring/15 focus-within:ring-[3px]",
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
      <Dialog open={!!addingLink} onOpenChange={() => setAddingLink(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insert Link</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="link-url">URL</Label>
            <Input
              id="link-url"
              value={addingLink?.url ?? ""}
              onChange={(e) => setAddingLink({ url: e.target.value })}
              type="url"
              placeholder="https://example.com"
              required
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                editor?.chain().focus().unsetLink().run();
                setAddingLink(null);
              }}
            >
              {currentLink ? "Unlink" : "Cancel"}
            </Button>
            <Button
              type="submit"
              onClick={() => {
                if (!addingLink?.url) return;
                editor?.chain().focus().extendMarkRange("link").setLink({ href: addingLink.url }).run();
                setAddingLink(null);
              }}
            >
              Insert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RichText;
