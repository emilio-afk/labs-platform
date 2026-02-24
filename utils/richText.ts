const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
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
  "blockquote",
  "pre",
  "code",
  "a",
  "img",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "td",
  "th",
  "hr",
  "small",
  "sup",
  "sub",
  "span",
  "div",
]);

const ALLOWED_STYLE_PROPS = new Set([
  "color",
  "background-color",
  "font-size",
  "line-height",
  "font-weight",
  "font-style",
  "text-decoration",
  "text-align",
  "margin-top",
  "margin-bottom",
  "margin-left",
  "margin-right",
  "padding-top",
  "padding-bottom",
  "padding-left",
  "padding-right",
  "border",
  "border-color",
  "border-width",
  "border-style",
  "border-radius",
  "display",
  "max-width",
  "width",
  "height",
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

      const safeAttributes: string[] = [];
      const rawStyle = extractStyleAttribute(String(attributes ?? ""));
      if (rawStyle) {
        const safeStyle = sanitizeStyle(rawStyle);
        if (safeStyle) {
          safeAttributes.push(`style="${escapeHtmlAttribute(safeStyle)}"`);
        }
      }

      if (tag === "a") {
        const rawHref = extractAttributeValue(String(attributes ?? ""), "href");
        const safeHref = sanitizeHref(rawHref);
        if (safeHref) {
          safeAttributes.push(`href="${escapeHtmlAttribute(safeHref)}"`);
        }

        const rawTarget = extractAttributeValue(String(attributes ?? ""), "target");
        if (rawTarget === "_blank") {
          safeAttributes.push('target="_blank"');
          safeAttributes.push('rel="noopener noreferrer"');
        }
      }

      if (tag === "img") {
        const rawSrc = extractAttributeValue(String(attributes ?? ""), "src");
        const safeSrc = sanitizeSrc(rawSrc);
        if (safeSrc) {
          safeAttributes.push(`src="${escapeHtmlAttribute(safeSrc)}"`);
        } else {
          return "";
        }

        const rawAlt = extractAttributeValue(String(attributes ?? ""), "alt");
        if (rawAlt) {
          safeAttributes.push(`alt="${escapeHtmlAttribute(rawAlt)}"`);
        }

        const rawTitle = extractAttributeValue(String(attributes ?? ""), "title");
        if (rawTitle) {
          safeAttributes.push(`title="${escapeHtmlAttribute(rawTitle)}"`);
        }

        const rawWidth = extractAttributeValue(String(attributes ?? ""), "width");
        const rawHeight = extractAttributeValue(String(attributes ?? ""), "height");
        if (isValidSizeToken(rawWidth)) {
          safeAttributes.push(`width="${escapeHtmlAttribute(rawWidth)}"`);
        }
        if (isValidSizeToken(rawHeight)) {
          safeAttributes.push(`height="${escapeHtmlAttribute(rawHeight)}"`);
        }
      }

      const className = sanitizeClassName(
        extractAttributeValue(String(attributes ?? ""), "class"),
      );
      if (className) {
        safeAttributes.push(`class="${escapeHtmlAttribute(className)}"`);
      }

      if (safeAttributes.length === 0) return `<${tag}>`;
      return `<${tag} ${safeAttributes.join(" ")}>`;
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

function extractAttributeValue(attributes: string, attributeName: string): string {
  if (!attributes) return "";
  const attributeRe = new RegExp(
    `\\b${attributeName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>\\\`]+))`,
    "i",
  );
  const match = attributes.match(attributeRe);
  if (!match) return "";
  return (match[1] ?? match[2] ?? match[3] ?? "").trim();
}

function sanitizeHref(rawHref: string): string {
  if (!rawHref) return "";
  const href = rawHref.trim();
  const lowered = href.toLowerCase();

  if (
    lowered.startsWith("javascript:") ||
    lowered.startsWith("data:") ||
    lowered.startsWith("vbscript:")
  ) {
    return "";
  }

  if (
    lowered.startsWith("http://") ||
    lowered.startsWith("https://") ||
    lowered.startsWith("mailto:") ||
    lowered.startsWith("tel:") ||
    href.startsWith("/") ||
    href.startsWith("#")
  ) {
    return href;
  }

  return "";
}

function sanitizeSrc(rawSrc: string): string {
  if (!rawSrc) return "";
  const src = rawSrc.trim();
  const lowered = src.toLowerCase();

  if (
    lowered.startsWith("javascript:") ||
    lowered.startsWith("data:") ||
    lowered.startsWith("vbscript:")
  ) {
    return "";
  }

  if (
    lowered.startsWith("http://") ||
    lowered.startsWith("https://") ||
    src.startsWith("/")
  ) {
    return src;
  }

  return "";
}

function sanitizeClassName(rawClass: string): string {
  if (!rawClass) return "";
  const safe = rawClass
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => /^[a-zA-Z0-9_-]+$/.test(token))
    .slice(0, 24);
  return safe.join(" ");
}

function isValidSizeToken(raw: string): boolean {
  if (!raw) return false;
  return /^[0-9]{1,4}(%|px)?$/.test(raw.trim());
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
