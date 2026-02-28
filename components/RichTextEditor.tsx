"use client";

import { sanitizeRichText } from "@/utils/richText";
import { mergeAttributes, type Editor } from "@tiptap/core";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import TextStyle from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useMemo, useRef, useState } from "react";

type RichTextEditorProps = {
  value: string;
  onChange: (nextHtml: string) => void;
  placeholder?: string;
  minHeightClassName?: string;
  compact?: boolean;
};

type EditorMode = "visual" | "html";
type FontUnit = "px" | "rem" | "em";

const FONT_SIZE_MIN = 1;
const FONT_SIZE_MAX = 128;
const LINE_HEIGHT_MIN = 0.5;
const LINE_HEIGHT_MAX = 4;
const DEFAULT_FONT_SIZE = "16";
const DEFAULT_FONT_UNIT: FontUnit = "px";
const DEFAULT_LINE_HEIGHT = "1.5";
const DEFAULT_TEXT_COLOR = "#f0f2da";
const DEFAULT_BG_COLOR = "#011963";

const StyledText = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      color: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.color || null,
      },
      backgroundColor: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.backgroundColor || null,
      },
      fontSize: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.fontSize || null,
      },
      lineHeight: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.lineHeight || null,
      },
    };
  },
  renderHTML({ HTMLAttributes }) {
    const attrs = HTMLAttributes as Record<string, unknown>;
    const color = sanitizeCssValue(attrs.color);
    const backgroundColor = sanitizeCssValue(attrs.backgroundColor);
    const fontSize = sanitizeFontSize(attrs.fontSize);
    const lineHeight = sanitizeLineHeight(attrs.lineHeight);

    const styleParts: string[] = [];
    if (color) styleParts.push(`color: ${color}`);
    if (backgroundColor) styleParts.push(`background-color: ${backgroundColor}`);
    if (fontSize) styleParts.push(`font-size: ${fontSize}`);
    if (lineHeight) styleParts.push(`line-height: ${lineHeight}`);

    return [
      "span",
      mergeAttributes(
        filterNonTextStyleAttributes(attrs),
        styleParts.length > 0 ? { style: styleParts.join("; ") } : {},
      ),
      0,
    ];
  },
});

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Escribe aquí...",
  minHeightClassName = "min-h-[120px]",
  compact = false,
}: RichTextEditorProps) {
  const [mode, setMode] = useState<EditorMode>("visual");
  const [htmlDraft, setHtmlDraft] = useState(sanitizeRichText(value));
  const [fontSizeValue, setFontSizeValue] = useState(DEFAULT_FONT_SIZE);
  const [fontSizeUnit, setFontSizeUnit] = useState<FontUnit>(DEFAULT_FONT_UNIT);
  const [lineHeightValue, setLineHeightValue] = useState(DEFAULT_LINE_HEIGHT);
  const [textColorValue, setTextColorValue] = useState(DEFAULT_TEXT_COLOR);
  const [bgColorValue, setBgColorValue] = useState(DEFAULT_BG_COLOR);
  const [selectionSize, setSelectionSize] = useState(0);
  const savedSelectionRef = useRef<{ from: number; to: number } | null>(null);
  const syncingExternalValueRef = useRef(false);

  const rememberCurrentSelection = (targetEditor?: Editor | null) => {
    const currentEditor = targetEditor ?? editor;
    if (!currentEditor) return;
    const { from, to } = currentEditor.state.selection;
    savedSelectionRef.current = { from, to };
    setSelectionSize(Math.max(0, to - from));
  };

  const createSelectionChain = (focusEditor = true) => {
    if (!editor) return null;
    const savedSelection = savedSelectionRef.current;
    const chain = focusEditor ? editor.chain().focus() : editor.chain();
    if (savedSelection) {
      chain.setTextSelection(savedSelection);
    }
    return chain;
  };

  const restoreVisibleSelection = () => {
    if (!editor) return;
    const savedSelection = savedSelectionRef.current;
    if (savedSelection) {
      editor.chain().focus().setTextSelection(savedSelection).run();
    } else {
      editor.commands.focus();
    }
    rememberCurrentSelection();
  };

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [1, 2, 3],
          },
        }),
        StyledText,
        Underline,
        Link.configure({
          openOnClick: false,
          autolink: true,
          HTMLAttributes: {
            rel: "noopener noreferrer",
            target: "_blank",
          },
        }),
        Placeholder.configure({ placeholder }),
        TextAlign.configure({
          types: ["heading", "paragraph"],
        }),
      ],
      editable: true,
      immediatelyRender: false,
      content: sanitizeRichText(value),
      editorProps: {
        attributes: {
          class: `${minHeightClassName} w-full rounded border border-gray-700 bg-gray-950 p-3 text-gray-100 outline-none focus:border-[var(--ast-mint)] [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mb-1`,
        },
        transformPastedHTML: (html) => sanitizeRichText(html),
      },
      onUpdate: ({ editor: nextEditor }) => {
        if (syncingExternalValueRef.current) return;
        const safeHtml = sanitizeRichText(nextEditor.getHTML());
        onChange(safeHtml);
      },
      onSelectionUpdate: ({ editor: nextEditor }) => {
        rememberCurrentSelection(nextEditor);
        syncControlsFromSelection(nextEditor, {
          setFontSizeValue,
          setFontSizeUnit,
          setLineHeightValue,
          setTextColorValue,
          setBgColorValue,
        });
      },
      onCreate: ({ editor: nextEditor }) => {
        rememberCurrentSelection(nextEditor);
        syncControlsFromSelection(nextEditor, {
          setFontSizeValue,
          setFontSizeUnit,
          setLineHeightValue,
          setTextColorValue,
          setBgColorValue,
        });
      },
    },
    [placeholder, minHeightClassName],
  );

  useEffect(() => {
    const safeValue = sanitizeRichText(value);
    if (!editor) return;

    const current = sanitizeRichText(editor.getHTML());
    if (normalizeHtml(current) === normalizeHtml(safeValue)) return;

    if (mode === "visual" && editor.isFocused) {
      return;
    }

    syncingExternalValueRef.current = true;
    editor.commands.setContent(safeValue, false);
    syncingExternalValueRef.current = false;
    setHtmlDraft(safeValue);
  }, [editor, mode, value]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(mode === "visual");
  }, [editor, mode]);

  const canEdit = useMemo(() => mode === "visual" && Boolean(editor), [editor, mode]);

  const switchMode = (nextMode: EditorMode) => {
    if (nextMode === mode) return;
    if (mode === "html") {
      applyHtmlDraft();
    } else if (editor) {
      setHtmlDraft(sanitizeRichText(editor.getHTML()));
    }
    setMode(nextMode);
  };

  const applyHtmlDraft = () => {
    const safeHtml = sanitizeRichText(htmlDraft);
    setHtmlDraft(safeHtml);
    onChange(safeHtml);
    if (!editor) return;
    syncingExternalValueRef.current = true;
    editor.commands.setContent(safeHtml, false);
    syncingExternalValueRef.current = false;
    syncControlsFromSelection(editor, {
      setFontSizeValue,
      setFontSizeUnit,
      setLineHeightValue,
      setTextColorValue,
      setBgColorValue,
    });
  };

  const applyFontSize = () => {
    if (!editor || !canEdit) return false;
    return applyFontSizeValue(fontSizeValue, fontSizeUnit, true);
  };

  const applyFontSizeValue = (
    rawValue: string,
    unit: FontUnit,
    focusEditor: boolean,
  ) => {
    if (!editor || !canEdit) return;
    const numericValue = parseNumericInput(rawValue);
    if (numericValue === null) return false;

    const clamped = Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, numericValue));
    const next = `${trimNumeric(clamped)}${unit}`;
    const chain = createSelectionChain(focusEditor);
    chain?.setMark("textStyle", { fontSize: next }).run();
    setFontSizeValue(trimNumeric(clamped));
    rememberCurrentSelection();
    return true;
  };

  const clearFontSize = () => {
    if (!editor || !canEdit) return;
    const chain = createSelectionChain();
    chain?.setMark("textStyle", { fontSize: null }).run();
    rememberCurrentSelection();
  };

  const applyLineHeight = () => {
    if (!editor || !canEdit) return false;
    return applyLineHeightValue(lineHeightValue, true);
  };

  const applyLineHeightValue = (rawValue: string, focusEditor: boolean) => {
    if (!editor || !canEdit) return false;
    const numericValue = parseNumericInput(rawValue);
    if (numericValue === null || numericValue <= 0) return false;
    const clamped = Math.min(LINE_HEIGHT_MAX, Math.max(LINE_HEIGHT_MIN, numericValue));
    const chain = createSelectionChain(focusEditor);
    chain?.setMark("textStyle", { lineHeight: trimNumeric(clamped) }).run();
    setLineHeightValue(trimNumeric(clamped));
    rememberCurrentSelection();
    return true;
  };

  const applyTextColor = (nextColor: string) => {
    setTextColorValue(nextColor);
    if (!editor || !canEdit) return;
    const chain = createSelectionChain();
    chain?.setMark("textStyle", { color: nextColor }).run();
    rememberCurrentSelection();
  };

  const clearTextColor = () => {
    if (!editor || !canEdit) return;
    const chain = createSelectionChain();
    chain?.setMark("textStyle", { color: null }).run();
    rememberCurrentSelection();
  };

  const applyBackgroundColor = (nextColor: string) => {
    setBgColorValue(nextColor);
    if (!editor || !canEdit) return;
    const chain = createSelectionChain();
    chain?.setMark("textStyle", { backgroundColor: nextColor }).run();
    rememberCurrentSelection();
  };

  const clearBackgroundColor = () => {
    if (!editor || !canEdit) return;
    const chain = createSelectionChain();
    chain?.setMark("textStyle", { backgroundColor: null }).run();
    rememberCurrentSelection();
  };

  const toggleLink = () => {
    if (!editor || !canEdit || typeof window === "undefined") return;

    const previousUrl = (editor.getAttributes("link").href as string | undefined) ?? "";
    const urlInput = window.prompt("URL del enlace", previousUrl || "https://");
    if (urlInput === null) return;

    const nextUrl = urlInput.trim();
    if (!nextUrl) {
      const chain = createSelectionChain();
      chain?.extendMarkRange("link").unsetLink().run();
      rememberCurrentSelection();
      return;
    }

    const chain = createSelectionChain();
    chain
      ?.extendMarkRange("link")
      .setLink({ href: nextUrl, target: "_blank", rel: "noopener noreferrer" })
      .run();
    rememberCurrentSelection();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <ToolbarButton
          label="Visual"
          title="Editor visual"
          compact={compact}
          active={mode === "visual"}
          onClick={() => switchMode("visual")}
        />
        <ToolbarButton
          label="HTML"
          title="Editar HTML"
          compact={compact}
          active={mode === "html"}
          onClick={() => switchMode("html")}
        />
      </div>

      <div
        className={`flex flex-wrap items-center gap-1.5 rounded border border-gray-700 bg-black/50 ${
          compact ? "p-1.5" : "p-2"
        } ${mode === "html" ? "opacity-60 pointer-events-none" : ""}`}
      >
        <ToolbarButton
          label="B"
          title="Negrita"
          compact={compact}
          active={Boolean(editor?.isActive("bold"))}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          label="I"
          title="Itálica"
          compact={compact}
          active={Boolean(editor?.isActive("italic"))}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          label="U"
          title="Subrayado"
          compact={compact}
          active={Boolean(editor?.isActive("underline"))}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        />
        <ToolbarButton
          label="S"
          title="Tachado"
          compact={compact}
          active={Boolean(editor?.isActive("strike"))}
          onClick={() => editor?.chain().focus().toggleStrike().run()}
        />
        <ToolbarButton
          label={compact ? "•" : "• Lista"}
          title="Lista con viñetas"
          compact={compact}
          active={Boolean(editor?.isActive("bulletList"))}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          label={compact ? "1." : "1. Lista"}
          title="Lista numerada"
          compact={compact}
          active={Boolean(editor?.isActive("orderedList"))}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        />
        <ToolbarButton
          label={compact ? "↔" : "Link"}
          title="Insertar o editar enlace"
          compact={compact}
          active={Boolean(editor?.isActive("link"))}
          onClick={toggleLink}
        />
        <ToolbarButton
          label={compact ? "←" : "Izq"}
          title="Alinear izquierda"
          compact={compact}
          active={Boolean(editor?.isActive({ textAlign: "left" }))}
          onClick={() => editor?.chain().focus().setTextAlign("left").run()}
        />
        <ToolbarButton
          label={compact ? "↔" : "Centro"}
          title="Alinear centro"
          compact={compact}
          active={Boolean(editor?.isActive({ textAlign: "center" }))}
          onClick={() => editor?.chain().focus().setTextAlign("center").run()}
        />
        <ToolbarButton
          label={compact ? "→" : "Der"}
          title="Alinear derecha"
          compact={compact}
          active={Boolean(editor?.isActive({ textAlign: "right" }))}
          onClick={() => editor?.chain().focus().setTextAlign("right").run()}
        />
        <ToolbarButton
          label={compact ? "↔↔" : "Just"}
          title="Justificar"
          compact={compact}
          active={Boolean(editor?.isActive({ textAlign: "justify" }))}
          onClick={() => editor?.chain().focus().setTextAlign("justify").run()}
        />
        <ToolbarButton
          label={compact ? "↺" : "Limpiar"}
          title="Limpiar formato"
          compact={compact}
          onClick={() =>
            editor
              ?.chain()
              .focus()
              .unsetAllMarks()
              .clearNodes()
              .run()
          }
        />

        <div className="flex items-center gap-1 rounded border border-gray-700 bg-black/70 px-1.5 py-1">
          <span className={compact ? "text-[10px] text-gray-300" : "text-[11px] text-gray-300"}>
            Font
          </span>
          <input
            type="number"
            min={FONT_SIZE_MIN}
            max={FONT_SIZE_MAX}
            step="0.1"
            inputMode="decimal"
            value={fontSizeValue}
            onMouseDown={() => rememberCurrentSelection()}
            onFocus={() => rememberCurrentSelection()}
            onChange={(event) => {
              const nextValue = event.target.value;
              setFontSizeValue(nextValue);
              applyFontSizeValue(nextValue, fontSizeUnit, false);
            }}
            onBlur={() => {
              applyFontSizeValue(fontSizeValue, fontSizeUnit, false);
              restoreVisibleSelection();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applyFontSize();
              }
            }}
            className={`w-16 rounded border border-gray-700 bg-black px-1.5 text-gray-200 ${
              compact ? "py-1 text-[11px]" : "py-1 text-xs"
            }`}
            aria-label="Tamaño de fuente numérico"
          />
          <select
            value={fontSizeUnit}
            onMouseDown={() => rememberCurrentSelection()}
            onFocus={() => rememberCurrentSelection()}
            onChange={(event) => {
              const nextUnit = event.target.value as FontUnit;
              setFontSizeUnit(nextUnit);
              applyFontSizeValue(fontSizeValue, nextUnit, false);
            }}
            onBlur={() => restoreVisibleSelection()}
            className={`rounded border border-gray-700 bg-black px-1.5 text-gray-200 ${
              compact ? "py-1 text-[11px]" : "py-1 text-xs"
            }`}
            aria-label="Unidad de tamaño de fuente"
          >
            <option value="px">px</option>
            <option value="rem">rem</option>
            <option value="em">em</option>
          </select>
          <ToolbarButton label="×" title="Quitar tamaño" compact={compact} onClick={clearFontSize} />
        </div>

        <div className="flex items-center gap-1 rounded border border-gray-700 bg-black/70 px-1.5 py-1">
          <span className={compact ? "text-[10px] text-gray-300" : "text-[11px] text-gray-300"}>
            LH
          </span>
          <input
            type="number"
            min={LINE_HEIGHT_MIN}
            max={LINE_HEIGHT_MAX}
            step="0.05"
            inputMode="decimal"
            value={lineHeightValue}
            onMouseDown={() => rememberCurrentSelection()}
            onFocus={() => rememberCurrentSelection()}
            onChange={(event) => {
              const nextValue = event.target.value;
              setLineHeightValue(nextValue);
              applyLineHeightValue(nextValue, false);
            }}
            onBlur={() => {
              applyLineHeightValue(lineHeightValue, false);
              restoreVisibleSelection();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applyLineHeight();
              }
            }}
            className={`w-14 rounded border border-gray-700 bg-black px-1.5 text-gray-200 ${
              compact ? "py-1 text-[11px]" : "py-1 text-xs"
            }`}
            aria-label="Interlineado"
          />
        </div>

        <label
          className={`inline-flex items-center gap-1 rounded border border-gray-700 bg-black text-gray-300 ${
            compact ? "px-1.5 py-1 text-[11px]" : "px-2 py-1 text-xs"
          }`}
          title="Color de texto"
        >
          A
          <input
            type="color"
            value={textColorValue}
            onMouseDown={() => rememberCurrentSelection()}
            onFocus={() => rememberCurrentSelection()}
            onChange={(event) => applyTextColor(event.target.value)}
            onBlur={() => restoreVisibleSelection()}
            className="h-5 w-5 cursor-pointer rounded border border-gray-700 bg-transparent p-0"
          />
        </label>
        <ToolbarButton
          label={compact ? "A×" : "Sin color"}
          title="Quitar color de texto"
          compact={compact}
          onClick={clearTextColor}
        />
        <label
          className={`inline-flex items-center gap-1 rounded border border-gray-700 bg-black text-gray-300 ${
            compact ? "px-1.5 py-1 text-[11px]" : "px-2 py-1 text-xs"
          }`}
          title="Color de fondo"
        >
          Bg
          <input
            type="color"
            value={bgColorValue}
            onMouseDown={() => rememberCurrentSelection()}
            onFocus={() => rememberCurrentSelection()}
            onChange={(event) => applyBackgroundColor(event.target.value)}
            onBlur={() => restoreVisibleSelection()}
            className="h-5 w-5 cursor-pointer rounded border border-gray-700 bg-transparent p-0"
          />
        </label>
        <ToolbarButton
          label={compact ? "Bg×" : "Sin highlight"}
          title="Quitar color de fondo"
          compact={compact}
          onClick={clearBackgroundColor}
        />
        <ToolbarButton
          label={compact ? "Sel" : "Re-seleccionar"}
          title="Volver a mostrar selección activa"
          compact={compact}
          onClick={restoreVisibleSelection}
        />
        <span className="ml-1 text-[10px] text-gray-400">
          {selectionSize > 0
            ? `Rango activo: ${selectionSize} caracteres`
            : "Sin selección: aplica en el cursor"}
        </span>
      </div>

      {mode === "visual" ? (
        <EditorContent editor={editor} />
      ) : (
        <div className="space-y-2">
          <textarea
            value={htmlDraft}
            onChange={(event) => setHtmlDraft(event.target.value)}
            onBlur={applyHtmlDraft}
            placeholder="Pega aquí tu HTML..."
            className={`${minHeightClassName} w-full rounded border border-gray-700 bg-gray-950 p-3 font-mono text-sm text-gray-100 outline-none focus:border-[var(--ast-mint)]`}
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-gray-400">
              Se aplica automáticamente al salir de este campo o al volver a modo Visual.
            </p>
            <button
              type="button"
              onClick={applyHtmlDraft}
              className="rounded border border-[var(--ast-mint)]/60 bg-[var(--ast-emerald)]/20 px-3 py-1 text-xs font-semibold text-[var(--ast-mint)] hover:bg-[var(--ast-emerald)]/30"
            >
              Aplicar HTML
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolbarButton({
  label,
  title,
  compact = false,
  active = false,
  onClick,
}: {
  label: string;
  title?: string;
  compact?: boolean;
  active?: boolean;
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
      className={`rounded border transition ${
        active
          ? "border-[var(--ast-mint)]/70 bg-[var(--ast-emerald)]/20 text-[var(--ast-mint)]"
          : "border-gray-700 bg-black text-gray-200 hover:border-gray-500 hover:bg-gray-900"
      } ${compact ? "px-1.5 py-1 text-[11px]" : "px-2 py-1 text-xs"}`}
    >
      {label}
    </button>
  );
}

function syncControlsFromSelection(
  editor: Editor,
  actions: {
    setFontSizeValue: (value: string) => void;
    setFontSizeUnit: (unit: FontUnit) => void;
    setLineHeightValue: (value: string) => void;
    setTextColorValue: (value: string) => void;
    setBgColorValue: (value: string) => void;
  },
) {
  const attrs = editor.getAttributes("textStyle") as Record<string, unknown>;

  const parsedFont = parseFontSize(attrs.fontSize);
  if (parsedFont) {
    actions.setFontSizeValue(parsedFont.value);
    actions.setFontSizeUnit(parsedFont.unit);
  } else {
    actions.setFontSizeValue(DEFAULT_FONT_SIZE);
    actions.setFontSizeUnit(DEFAULT_FONT_UNIT);
  }

  const lineHeight = sanitizeLineHeight(attrs.lineHeight);
  actions.setLineHeightValue(lineHeight ?? DEFAULT_LINE_HEIGHT);

  const textColor = toHexColor(attrs.color) ?? DEFAULT_TEXT_COLOR;
  actions.setTextColorValue(textColor);

  const bgColor = toHexColor(attrs.backgroundColor) ?? DEFAULT_BG_COLOR;
  actions.setBgColorValue(bgColor);
}

function parseFontSize(value: unknown): { value: string; unit: FontUnit } | null {
  if (typeof value !== "string") return null;
  const match = value.trim().toLowerCase().match(/^(\d+(?:\.\d+)?)(px|rem|em)$/);
  if (!match) return null;
  return { value: trimNumeric(Number(match[1])), unit: match[2] as FontUnit };
}

function trimNumeric(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function parseNumericInput(raw: string): number | null {
  const normalized = raw.trim().replace(",", ".");
  if (!normalized) return null;
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function sanitizeCssValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/url\s*\(/i.test(trimmed)) return null;
  if (/expression\s*\(/i.test(trimmed)) return null;
  if (/javascript:/i.test(trimmed)) return null;
  return trimmed;
}

function sanitizeFontSize(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return /^\d+(?:\.\d+)?(px|rem|em)$/.test(trimmed) ? trimmed : null;
}

function sanitizeLineHeight(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "normal") return "normal";
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) return trimmed;
  if (/^\d+(?:\.\d+)?(px|rem|em)$/.test(trimmed)) return trimmed;
  return null;
}

function filterNonTextStyleAttributes(
  attrs: Record<string, unknown>,
): Record<string, string> {
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (
      key === "color" ||
      key === "backgroundColor" ||
      key === "fontSize" ||
      key === "lineHeight"
    ) {
      continue;
    }
    if (typeof value === "string") {
      output[key] = value;
    }
  }
  return output;
}

function toHexColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const hex = normalizeHex(trimmed);
  if (hex) return hex;

  const rgbMatch = trimmed.match(
    /^rgba?\(\s*([01]?\d?\d|2[0-4]\d|25[0-5])\s*,\s*([01]?\d?\d|2[0-4]\d|25[0-5])\s*,\s*([01]?\d?\d|2[0-4]\d|25[0-5])(?:\s*,\s*(0|0?\.\d+|1(?:\.0+)?))?\s*\)$/i,
  );
  if (!rgbMatch) return null;

  const r = Number(rgbMatch[1]);
  const g = Number(rgbMatch[2]);
  const b = Number(rgbMatch[3]);
  return `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`;
}

function normalizeHex(value: string): string | null {
  const raw = value.trim().toLowerCase();
  if (!/^#[0-9a-f]{3}([0-9a-f]{3})?$/.test(raw)) return null;
  if (raw.length === 7) return raw;
  const r = raw[1];
  const g = raw[2];
  const b = raw[3];
  return `#${r}${r}${g}${g}${b}${b}`;
}

function toHex2(value: number): string {
  return value.toString(16).padStart(2, "0");
}

function normalizeHtml(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}
