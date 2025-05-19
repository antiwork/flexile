import { Link } from "@tiptap/extension-link";
import { Underline } from "@tiptap/extension-underline";
import { StarterKit } from "@tiptap/starter-kit";

export const richTextExtensions = [
  StarterKit.configure({ listItem: { HTMLAttributes: { class: "[&>p]:inline" } } }),
  Link.configure({ defaultProtocol: "https" }),
  Underline,
];
