export function normalizeLabSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function normalizeOptionalUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (value.length > 1024) return null;
  return value;
}

export function normalizeAccentColor(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const shortHexMatch = value.match(/^#([0-9a-fA-F]{3})$/);
  if (shortHexMatch) {
    const [r, g, b] = shortHexMatch[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  const hexMatch = value.match(/^#([0-9a-fA-F]{6})$/);
  if (hexMatch) return `#${hexMatch[1].toUpperCase()}`;
  return null;
}

export function isMissingColumnError(message: string, column: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("column") &&
    lower.includes(column.toLowerCase()) &&
    (lower.includes("does not exist") || lower.includes("schema cache"))
  );
}
