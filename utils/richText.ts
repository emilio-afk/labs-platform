const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "b",
  "strong",
  "i",
  "em",
  "u",
  "s",
  "strike",
  "ul",
  "ol",
  "li",
  "span",
  "div",
]);

const ALLOWED_STYLE_PROPS = new Set([
  "color",
  "background-color",
  "font-size",
  "font-weight",
  "font-style",
  "text-decoration",
]);

const DANGEROUS_TAG_BLOCK_RE =
  /<\s*(script|style|iframe|object|embed|link|meta)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;

const DANGEROUS_SELF_CLOSING_RE =
  /<\s*(script|style|iframe|object|embed|link|meta)\b[^>]*\/?\s*>/gi;

export function normalizeRichTextInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const looksLikeHtml = /<[^>]+>/.test(trimmed);
  if (looksLikeHtml) {
    return sanitizeRichText(trimmed);
  }

  const paragraphs = trimmed
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`);

  return sanitizeRichText(paragraphs.join(""));
}

export function hasRichTextContent(raw: string): boolean {
  return stripRichText(raw).trim().length > 0;
}

export function stripRichText(raw: string): string {
  if (!raw) return "";
  const withoutDangerous = raw
    .replace(DANGEROUS_TAG_BLOCK_RE, " ")
    .replace(DANGEROUS_SELF_CLOSING_RE, " ");
  const normalized = withoutDangerous
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*li\b[^>]*>/gi, "• ")
    .replace(/<\s*\/\s*(p|div|li|ul|ol)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, " ");
  const decoded = decodeHtmlEntities(normalized).replace(/\r/g, "");

  return decoded
    .replace(/[^\S\n]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

export function sanitizeRichText(raw: string): string {
  if (!raw) return "";
  const withoutDangerous = raw
    .replace(DANGEROUS_TAG_BLOCK_RE, "")
    .replace(DANGEROUS_SELF_CLOSING_RE, "");
  return sanitizeWithRegex(withoutDangerous);
}

function sanitizeWithRegex(raw: string): string {
  return raw.replace(
    /<(\/?)([a-z0-9-]+)([^>]*)>/gi,
    (_match, slash, tagName, attributes) => {
      const tag = String(tagName).toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) return "";
      if (slash) return `</${tag}>`;
      if (tag === "br") return "<br />";

      const rawStyle = extractStyleAttribute(String(attributes ?? ""));
      if (!rawStyle) return `<${tag}>`;

      const safeStyle = sanitizeStyle(rawStyle);
      if (!safeStyle) return `<${tag}>`;

      return `<${tag} style="${escapeHtmlAttribute(safeStyle)}">`;
    },
  );
}

function sanitizeStyle(styleValue: string): string {
  return styleValue
    .split(";")
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .map((declaration) => {
      const separator = declaration.indexOf(":");
      if (separator < 0) return null;

      const property = declaration.slice(0, separator).trim().toLowerCase();
      const value = declaration.slice(separator + 1).trim();

      if (!ALLOWED_STYLE_PROPS.has(property)) return null;
      const loweredValue = value.toLowerCase();
      if (
        loweredValue.includes("expression(") ||
        loweredValue.includes("javascript:") ||
        loweredValue.includes("url(")
      ) {
        return null;
      }

      return `${property}: ${value}`;
    })
    .filter((declaration): declaration is string => Boolean(declaration))
    .join("; ");
}

function extractStyleAttribute(attributes: string): string {
  if (!attributes) return "";
  const styleMatch = attributes.match(
    /\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i,
  );
  if (!styleMatch) return "";
  return (styleMatch[1] ?? styleMatch[2] ?? styleMatch[3] ?? "").trim();
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
