import type { Editor } from "@tiptap/core";
import { isAllowedUri, Link } from "@tiptap/extension-link";
import { TextAlign } from "@tiptap/extension-text-align";
import { Underline } from "@tiptap/extension-underline";
import { StarterKit } from "@tiptap/starter-kit";
import { tokenize } from "linkifyjs";

export const richTextExtensions = [
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  StarterKit.configure({ listItem: { HTMLAttributes: { class: "[&>p]:inline" } } }),
  Link.configure({ defaultProtocol: "https" }),
  Underline,
];

export function linkifyContent(editor: Editor, defaultProtocol = "https") {
  const linkType = editor.schema.marks.link;
  if (!linkType) return;

  const codeMark = editor.schema.marks.code;
  const { state } = editor;
  const { doc } = state;
  let tr = state.tr;

  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;

    const text = node.textBetween(0, node.content.size, undefined, " ");
    if (!text) return true;

    const re = /\S+/gu;
    for (const match of text.matchAll(re)) {
      const word = match[0];
      const wordStart = match.index;

      const tokens = tokenize(word).map((t) => t.toObject(defaultProtocol));
      if (!tokens.length) continue;

      for (const t of tokens) {
        if (!t.isLink) continue;

        const from = pos + 1 + wordStart + t.start;
        const to = pos + 1 + wordStart + t.end;

        const isAlreadyLinked = tr.doc.rangeHasMark(from, to, linkType) || doc.rangeHasMark(from, to, linkType);
        if (isAlreadyLinked) continue;

        const isInsideCode =
          codeMark && (tr.doc.rangeHasMark(from, to, codeMark) || doc.rangeHasMark(from, to, codeMark));
        if (isInsideCode) continue;

        const href = t.href;
        if (!href || !isAllowedUri(href)) continue;

        tr = tr.addMark(from, to, linkType.create({ href }));
      }
    }

    return true;
  });

  if (tr.steps.length) {
    editor.view.dispatch(tr);
  }
}
