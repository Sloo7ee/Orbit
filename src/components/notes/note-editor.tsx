"use client";
import { useState } from "react";
import {
  EditorContent,
  useEditor,
  useEditorState,
  type Editor,
  type JSONContent,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Quote,
  Code,
  Link2,
  Undo2,
  Redo2,
} from "lucide-react";
import { IconButton, Button } from "@/components/ui/primitives";
import { EditorDialog } from "@/components/ui/editor-dialog";
import { safeNoteLink } from "@/lib/domain/notes";
const extensions = [
  StarterKit.configure({
    codeBlock: false,
    horizontalRule: false,
    hardBreak: false,
    strike: false,
    heading: { levels: [1, 2, 3] },
    trailingNode: false,
    link: {
      openOnClick: false,
      autolink: false,
      linkOnPaste: false,
      isAllowedUri: safeNoteLink,
    },
  }),
];
export function NoteEditor({
  content,
  readOnly,
  onChange,
}: {
  content: JSONContent;
  readOnly: boolean;
  onChange: (content: JSONContent) => void;
}) {
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState("");
  const editor = useEditor({
    extensions,
    content,
    editable: !readOnly,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-label": "Note content",
        "aria-multiline": "true",
        "aria-readonly": String(readOnly),
        spellcheck: "true",
      },
    },
    // ProseMirror attributes use null-prototype objects; Server Actions require plain JSON.
    onUpdate: ({ editor }) =>
      onChange(JSON.parse(JSON.stringify(editor.getJSON())) as JSONContent),
  });
  const selected = useEditorState({
    editor,
    selector: ({ editor: e }) => (e ? selectionState(e) : null),
  });
  if (!editor) return <p role="status">Opening note…</p>;
  const selection = selected ?? selectionState(editor);
  const controls = [
    {
      name: "Bold",
      icon: Bold,
      active: selection.bold,
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      name: "Italic",
      icon: Italic,
      active: selection.italic,
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      name: "Underline",
      icon: Underline,
      active: selection.underline,
      run: () => editor.chain().focus().toggleUnderline().run(),
    },
    {
      name: "Bullet list",
      icon: List,
      active: selection.bulletList,
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      name: "Numbered list",
      icon: ListOrdered,
      active: selection.orderedList,
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      name: "Blockquote",
      icon: Quote,
      active: selection.blockquote,
      run: () => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      name: "Inline code",
      icon: Code,
      active: selection.code,
      run: () => editor.chain().focus().toggleCode().run(),
    },
  ];
  return (
    <>
      {!readOnly && (
        <div className="note-toolbar" role="group" aria-label="Text formatting">
          <select
            aria-label="Text style"
            value={selection.heading}
            onChange={(e) => {
              const level = Number(e.target.value);
              if (!level) editor.chain().focus().setParagraph().run();
              else
                editor
                  .chain()
                  .focus()
                  .setHeading({ level: level as 1 | 2 | 3 })
                  .run();
            }}
          >
            <option value="0">Paragraph</option>
            <option value="1">Heading 1</option>
            <option value="2">Heading 2</option>
            <option value="3">Heading 3</option>
          </select>
          {controls.map(({ name, icon: Icon, active, run }) => (
            <IconButton
              key={name}
              label={name}
              aria-pressed={active}
              onClick={run}
            >
              <Icon size={16} />
            </IconButton>
          ))}
          <IconButton
            label="Link"
            aria-pressed={selection.link}
            onClick={() => {
              setError("");
              setLink(editor.getAttributes("link").href ?? "");
            }}
          >
            <Link2 size={16} />
          </IconButton>
          <span className="toolbar-divider" />
          <IconButton
            label="Undo"
            disabled={!selection.undo}
            onClick={() => editor.chain().focus().undo().run()}
          >
            <Undo2 size={16} />
          </IconButton>
          <IconButton
            label="Redo"
            disabled={!selection.redo}
            onClick={() => editor.chain().focus().redo().run()}
          >
            <Redo2 size={16} />
          </IconButton>
        </div>
      )}
      <EditorContent editor={editor} className="note-writing" />
      {link !== null && (
        <EditorDialog title="Edit link" onClose={() => setLink(null)}>
          <form
            className="action-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!safeNoteLink(link.trim())) {
                setError("Use a full https://, http:// or mailto: address.");
                return;
              }
              const chain = editor.chain().focus().extendMarkRange("link");
              if (editor.state.selection.empty && !editor.isActive("link"))
                chain
                  .insertContent({
                    type: "text",
                    text: link.trim(),
                    marks: [{ type: "link", attrs: { href: link.trim() } }],
                  })
                  .run();
              else chain.setLink({ href: link.trim() }).run();
              setLink(null);
            }}
          >
            <label>
              Link address
              <input
                autoFocus
                value={link}
                onChange={(e) => setLink(e.target.value)}
                maxLength={2048}
              />
            </label>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <div className="form-actions">
              <Button type="submit" variant="primary">
                Apply link
              </Button>
              <Button
                onClick={() => {
                  editor
                    .chain()
                    .focus()
                    .extendMarkRange("link")
                    .unsetLink()
                    .run();
                  setLink(null);
                }}
              >
                Remove link
              </Button>
            </div>
          </form>
        </EditorDialog>
      )}
    </>
  );
}

function selectionState(e: Editor) {
  return {
    bold: e.isActive("bold"),
    italic: e.isActive("italic"),
    underline: e.isActive("underline"),
    bulletList: e.isActive("bulletList"),
    orderedList: e.isActive("orderedList"),
    blockquote: e.isActive("blockquote"),
    code: e.isActive("code"),
    link: e.isActive("link"),
    heading: e.isActive("heading")
      ? String(e.getAttributes("heading").level)
      : "0",
    undo: e.can().undo(),
    redo: e.can().redo(),
  };
}
