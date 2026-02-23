"use client";

import { useEffect, useId, useRef } from "react";

const FONT_SIZE_TO_PX: Record<string, string> = {
  "2": "14px",
  "3": "16px",
  "4": "20px",
  "5": "30px",
};

const NAMED_FONT_SIZE_TO_PX: Record<string, string> = {
  "x-small": "12px",
  small: "14px",
  medium: "16px",
  large: "20px",
  "x-large": "30px",
  "xx-large": "36px",
};

type RichTextEditorProps = {
  value: string;
  onChange: (nextHtml: string) => void;
  placeholder?: string;
  minHeightClassName?: string;
  compact?: boolean;
};

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Escribe aquí...",
  minHeightClassName = "min-h-[120px]",
  compact = false,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const colorInputId = useId();
  const bgColorInputId = useId();

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    let normalized = false;
    if (editor.innerHTML !== value) {
      editor.innerHTML = value || "";
      normalized = normalizeFontMarkup(editor);
    } else {
      normalized = normalizeFontMarkup(editor);
    }

    if (normalized && editor.innerHTML !== value) {
      onChange(editor.innerHTML);
    }
  }, [onChange, value]);

  const emitChange = () => {
    const editor = editorRef.current;
    if (!editor) return;
    onChange(editor.innerHTML);
  };

  const rememberSelection = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    if (
      !isNodeInsideEditor(editor, selection.anchorNode) ||
      !isNodeInsideEditor(editor, selection.focusNode)
    ) {
      return;
    }
    savedRangeRef.current = selection.getRangeAt(0).cloneRange();
  };

  const restoreSavedSelection = (selection: Selection) => {
    const editor = editorRef.current;
    if (!editor) return false;
    const saved = savedRangeRef.current;
    if (!saved) return false;

    try {
      if (
        !isNodeInsideEditor(editor, saved.startContainer) ||
        !isNodeInsideEditor(editor, saved.endContainer)
      ) {
        return false;
      }
      selection.removeAllRanges();
      selection.addRange(saved);
      return true;
    } catch {
      return false;
    }
  };

  const ensureSelectionInsideEditor = () => {
    const editor = editorRef.current;
    if (!editor) return null;

    editor.focus();
    const selection = window.getSelection();
    if (!selection) return null;

    const hasSelectionInsideEditor =
      selection.rangeCount > 0 &&
      isNodeInsideEditor(editor, selection.anchorNode) &&
      isNodeInsideEditor(editor, selection.focusNode);

    if (
      selection.rangeCount === 0 ||
      (!hasSelectionInsideEditor && !restoreSavedSelection(selection))
    ) {
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    rememberSelection();
    return selection;
  };

  const applySpanStyle = (styles: Record<string, string>) => {
    const editor = editorRef.current;
    if (!editor) return false;
    const selection = ensureSelectionInsideEditor();
    if (!selection || selection.rangeCount === 0) return false;

    const range = selection.getRangeAt(0);
    const span = document.createElement("span");
    for (const [key, value] of Object.entries(styles)) {
      span.style.setProperty(key, value);
    }

    if (range.collapsed) {
      span.textContent = "\u200b";
      range.insertNode(span);

      const nextRange = document.createRange();
      nextRange.setStart(span.firstChild ?? span, 1);
      nextRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(nextRange);
      rememberSelection();
      return true;
    }

    const fragment = range.extractContents();
    span.appendChild(fragment);
    range.insertNode(span);

    const nextRange = document.createRange();
    nextRange.selectNodeContents(span);
    nextRange.collapse(false);
    selection.removeAllRanges();
    selection.addRange(nextRange);
    rememberSelection();
    return true;
  };

  const runCommand = (command: string, commandValue?: string) => {
    ensureSelectionInsideEditor();
    document.execCommand("styleWithCSS", false, "true");
    const ok = document.execCommand(command, false, commandValue);
    emitChange();
    rememberSelection();
    return ok;
  };

  const runListCommand = (ordered: boolean) => {
    const command = ordered ? "insertOrderedList" : "insertUnorderedList";
    const ok = runCommand(command);
    if (!ok) {
      const fallbackHtml = ordered
        ? "<ol><li>\u200b</li></ol>"
        : "<ul><li>\u200b</li></ul>";
      runCommand("insertHTML", fallbackHtml);
    }
  };

  const runColorCommand = (command: "foreColor" | "hiliteColor", color: string) => {
    const ok = runCommand(command, color);
    if (ok) return;

    if (command === "hiliteColor") {
      const backOk = runCommand("backColor", color);
      if (backOk) return;
      applySpanStyle({ "background-color": color });
      emitChange();
      return;
    }

    applySpanStyle({ color });
    emitChange();
  };

  const runFontSizeCommand = (sizeToken: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    const ok = runCommand("fontSize", sizeToken);
    if (!ok) {
      const px = FONT_SIZE_TO_PX[sizeToken] ?? "16px";
      applySpanStyle({ "font-size": px });
    }
    normalizeFontMarkup(editor);
    emitChange();
  };

  return (
    <div className="space-y-2">
      <div
        className={`flex flex-wrap items-center gap-1.5 rounded border border-gray-700 bg-black/50 ${
          compact ? "p-1.5" : "p-2"
        }`}
      >
        <ToolbarButton
          label="B"
          title="Negrita"
          compact={compact}
          onClick={() => runCommand("bold")}
        />
        <ToolbarButton
          label="I"
          title="Itálica"
          compact={compact}
          onClick={() => runCommand("italic")}
        />
        <ToolbarButton
          label="U"
          title="Subrayado"
          compact={compact}
          onClick={() => runCommand("underline")}
        />
        <ToolbarButton
          label="S"
          title="Tachado"
          compact={compact}
          onClick={() => runCommand("strikeThrough")}
        />
        <ToolbarButton
          label={compact ? "•" : "• Lista"}
          title="Lista con viñetas"
          compact={compact}
          onClick={() => runListCommand(false)}
        />
        <ToolbarButton
          label={compact ? "1." : "1. Lista"}
          title="Lista numerada"
          compact={compact}
          onClick={() => runListCommand(true)}
        />
        <ToolbarButton
          label={compact ? "↺" : "Limpiar"}
          title="Limpiar formato"
          compact={compact}
          onClick={() => runCommand("removeFormat")}
        />

        <select
          defaultValue="3"
          onMouseDown={rememberSelection}
          onFocus={rememberSelection}
          onChange={(e) => runFontSizeCommand(e.target.value)}
          className={`rounded border border-gray-700 bg-black text-gray-200 ${
            compact ? "px-1.5 py-1 text-[11px]" : "px-2 py-1 text-xs"
          }`}
          aria-label="Tamaño de fuente"
        >
          <option value="2">{compact ? "S" : "Texto pequeño"}</option>
          <option value="3">{compact ? "M" : "Texto normal"}</option>
          <option value="4">{compact ? "L" : "Texto grande"}</option>
          <option value="5">Título</option>
        </select>

        <label
          htmlFor={colorInputId}
          className={`inline-flex items-center gap-1 rounded border border-gray-700 bg-black text-gray-300 ${
            compact ? "px-1.5 py-1 text-[11px]" : "px-2 py-1 text-xs"
          }`}
          title="Color de texto"
        >
          {compact ? "A" : "Color"}
          <input
            id={colorInputId}
            type="color"
            defaultValue="#f0f2da"
            onMouseDown={rememberSelection}
            onFocus={rememberSelection}
            onChange={(e) => runColorCommand("foreColor", e.target.value)}
            className="h-5 w-5 cursor-pointer rounded border border-gray-700 bg-transparent p-0"
          />
        </label>

        <label
          htmlFor={bgColorInputId}
          className={`inline-flex items-center gap-1 rounded border border-gray-700 bg-black text-gray-300 ${
            compact ? "px-1.5 py-1 text-[11px]" : "px-2 py-1 text-xs"
          }`}
          title="Color de fondo"
        >
          {compact ? "Bg" : "Fondo"}
          <input
            id={bgColorInputId}
            type="color"
            defaultValue="#011963"
            onMouseDown={rememberSelection}
            onFocus={rememberSelection}
            onChange={(e) => runColorCommand("hiliteColor", e.target.value)}
            className="h-5 w-5 cursor-pointer rounded border border-gray-700 bg-transparent p-0"
          />
        </label>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label={placeholder}
        data-placeholder={placeholder}
        onInput={() => {
          emitChange();
          rememberSelection();
        }}
        onMouseUp={rememberSelection}
        onKeyUp={rememberSelection}
        onBlur={rememberSelection}
        className={`${minHeightClassName} w-full rounded border border-gray-700 bg-gray-950 p-3 text-gray-100 outline-none focus:border-[var(--ast-mint)] [&_h1]:my-0 [&_h2]:my-0 [&_h3]:my-0 [&_h4]:my-0 [&_h5]:my-0 [&_h6]:my-0 [&_h1]:text-[1em] [&_h2]:text-[1em] [&_h3]:text-[1em] [&_h4]:text-[1em] [&_h5]:text-[1em] [&_h6]:text-[1em] [&_h1]:font-inherit [&_h2]:font-inherit [&_h3]:font-inherit [&_h4]:font-inherit [&_h5]:font-inherit [&_h6]:font-inherit [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mb-1 [&:empty:before]:text-gray-500 [&:empty:before]:content-[attr(data-placeholder)]`}
      />
    </div>
  );
}

function isNodeInsideEditor(editor: HTMLElement, node: Node | null): boolean {
  if (!node) return false;
  return node === editor || editor.contains(node);
}

function normalizeFontMarkup(root: HTMLElement): boolean {
  let changed = false;

  const fontElements = Array.from(root.querySelectorAll("font"));
  for (const font of fontElements) {
    const sizeToken = (font.getAttribute("size") ?? "").trim();
    const mappedSize =
      FONT_SIZE_TO_PX[sizeToken] ||
      NAMED_FONT_SIZE_TO_PX[(font.style.fontSize || "").trim().toLowerCase()] ||
      "";

    const span = document.createElement("span");
    if (mappedSize) {
      span.style.fontSize = mappedSize;
    }
    const color = (font.getAttribute("color") ?? "").trim();
    if (color) {
      span.style.color = color;
    }

    while (font.firstChild) {
      span.appendChild(font.firstChild);
    }
    font.replaceWith(span);
    changed = true;
  }

  const styledElements = Array.from(root.querySelectorAll<HTMLElement>("[style]"));
  for (const element of styledElements) {
    const rawSize = element.style.fontSize?.trim().toLowerCase();
    if (!rawSize) continue;
    const mappedSize = NAMED_FONT_SIZE_TO_PX[rawSize];
    if (!mappedSize) continue;
    element.style.fontSize = mappedSize;
    changed = true;
  }

  return changed;
}

function ToolbarButton({
  label,
  title,
  compact = false,
  onClick,
}: {
  label: string;
  title?: string;
  compact?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onMouseDown={(event) => {
        event.preventDefault();
      }}
      onClick={onClick}
      title={title}
      className={`rounded border border-gray-700 bg-black text-gray-200 transition hover:border-gray-500 hover:bg-gray-900 ${
        compact ? "px-1.5 py-1 text-[11px]" : "px-2 py-1 text-xs"
      }`}
    >
      {label}
    </button>
  );
}
