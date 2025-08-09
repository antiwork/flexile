import { Link } from "@tiptap/extension-link";
import { TextAlign } from "@tiptap/extension-text-align";
import { Underline } from "@tiptap/extension-underline";
import { StarterKit } from "@tiptap/starter-kit";

export const richTextExtensions = [
  TextAlign.configure({
    types: ["heading", "paragraph"],
  }),
  StarterKit.configure({ listItem: { HTMLAttributes: { class: "[&>p]:inline" } } }),
  Link.configure({ defaultProtocol: "https" }),
  Underline,
];
