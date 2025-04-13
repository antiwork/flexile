import { Bars2Icon, BoldIcon, ItalicIcon, LinkIcon, ListBulletIcon, UnderlineIcon } from "@heroicons/react/24/outline";
import type { Content } from "@tiptap/core";
import { EditorContent, isList, useEditor } from "@tiptap/react";
import React, { useEffect, useState } from "react";
import Input, { formGroupClasses } from "@/components/Input";
import { linkClasses } from "@/components/Link";
import Modal from "@/components/Modal";
import { Button } from "@/components/ui/button";
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
  label,
  value,
  invalid,
  onChange,
  className,
}: {
  label?: string;
  value: string | null;
  invalid?: boolean;
  onChange: (value: string) => void;
  className?: string;
}) => {
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
        class: cn(className, "prose p-4 max-h-96 overflow-y-auto max-w-full rounded-b-md", {
          "outline-red": invalid,
        }),
        "aria-invalid": String(invalid),
        "aria-label": label ?? "",
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
    <div className={formGroupClasses}>
      {label ? (
        <Label htmlFor={id} className="cursor-pointer">
          {label}
        </Label>
      ) : null}
      <div className={cn("rounded-md border", { "border-red": invalid })}>
        <div className={cn("flex border-b", { "border-red": invalid })}>
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
      </div>
      <Modal open={!!addingLink} onClose={() => setAddingLink(null)} title="Insert Link">
        <Input
          value={addingLink?.url ?? ""}
          onChange={(url) => setAddingLink({ url })}
          type="url"
          label="URL"
          placeholder="https://example.com"
          required
        />
        <div className="modal-footer">
          <Button
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
              if (!addingLink) return;
              editor?.chain().focus().extendMarkRange("link").setLink({ href: addingLink.url }).run();
              setAddingLink(null);
            }}
          >
            Insert
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default RichText;
