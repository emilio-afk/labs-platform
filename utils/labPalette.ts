export type LabPalette = {
  cardBackground: string;
  borderColor: string;
  outlineShadow: string;
  accentColor: string;
  glowColor: string;
  chipBackground: string;
  chipTextColor: string;
};

type LabPaletteTemplate = Omit<LabPalette, "cardBackground"> & {
  backgroundOverlay: string;
};

const DEFAULT_LAB_PEOPLE_BG = "/labs-people.bg.png";

const LAB_PALETTES: readonly LabPaletteTemplate[] = [
  {
    backgroundOverlay:
      "linear-gradient(165deg, rgba(38, 38, 38, 0.84), rgba(38, 38, 38, 0.78), rgba(7, 68, 168, 0.18))",
    borderColor: "rgba(185, 214, 254, 0.52)",
    outlineShadow:
      "0 0 0 1px rgba(185,214,254,0.56), 0 0 0 2px rgba(185,214,254,0.14), 0 0 24px rgba(10,86,198,0.20)",
    accentColor: "var(--ast-sky)",
    glowColor: "rgba(10, 86, 198, 0.20)",
    chipBackground: "rgba(7, 68, 168, 0.22)",
    chipTextColor: "var(--ast-sky)",
  },
  {
    backgroundOverlay:
      "linear-gradient(165deg, rgba(38, 38, 38, 0.84), rgba(38, 38, 38, 0.78), rgba(3, 137, 76, 0.20))",
    borderColor: "rgba(4, 164, 90, 0.52)",
    outlineShadow:
      "0 0 0 1px rgba(4,164,90,0.56), 0 0 0 2px rgba(4,164,90,0.14), 0 0 24px rgba(4,164,90,0.20)",
    accentColor: "var(--ast-mint)",
    glowColor: "rgba(4, 164, 90, 0.20)",
    chipBackground: "rgba(3, 137, 76, 0.22)",
    chipTextColor: "var(--ast-bone)",
  },
  {
    backgroundOverlay:
      "linear-gradient(165deg, rgba(38, 38, 38, 0.84), rgba(38, 38, 38, 0.78), rgba(224, 93, 46, 0.18))",
    borderColor: "rgba(246, 109, 58, 0.54)",
    outlineShadow:
      "0 0 0 1px rgba(246,109,58,0.58), 0 0 0 2px rgba(246,109,58,0.16), 0 0 24px rgba(246,109,58,0.22)",
    accentColor: "var(--ast-yellow)",
    glowColor: "rgba(246, 109, 58, 0.22)",
    chipBackground: "rgba(224, 93, 46, 0.22)",
    chipTextColor: "var(--ast-yellow)",
  },
  {
    backgroundOverlay:
      "linear-gradient(165deg, rgba(38, 38, 38, 0.84), rgba(38, 38, 38, 0.78), rgba(243, 177, 215, 0.18))",
    borderColor: "rgba(243, 177, 215, 0.52)",
    outlineShadow:
      "0 0 0 1px rgba(243,177,215,0.56), 0 0 0 2px rgba(243,177,215,0.14), 0 0 24px rgba(243,177,215,0.20)",
    accentColor: "var(--ast-pink)",
    glowColor: "rgba(243, 177, 215, 0.20)",
    chipBackground: "rgba(243, 177, 215, 0.20)",
    chipTextColor: "var(--ast-bone)",
  },
  {
    backgroundOverlay:
      "linear-gradient(165deg, rgba(38, 38, 38, 0.86), rgba(38, 38, 38, 0.80), rgba(240, 242, 218, 0.14))",
    borderColor: "rgba(240, 242, 218, 0.52)",
    outlineShadow:
      "0 0 0 1px rgba(240,242,218,0.54), 0 0 0 2px rgba(240,242,218,0.12), 0 0 22px rgba(240,242,218,0.16)",
    accentColor: "var(--ast-yellow)",
    glowColor: "rgba(240, 242, 218, 0.16)",
    chipBackground: "rgba(240, 242, 218, 0.16)",
    chipTextColor: "var(--ast-bone)",
  },
];

export function getLabPalette(
  seed: string,
  backgroundImageUrl?: string | null,
  accentColorOverride?: string | null,
): LabPalette {
  if (!seed) {
    return materializePalette(LAB_PALETTES[0], backgroundImageUrl, accentColorOverride);
  }
  const index = hashSeed(seed) % LAB_PALETTES.length;
  return materializePalette(LAB_PALETTES[index], backgroundImageUrl, accentColorOverride);
}

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function materializePalette(
  template: LabPaletteTemplate,
  backgroundImageUrl?: string | null,
  accentColorOverride?: string | null,
): LabPalette {
  const primaryImageUrl =
    typeof backgroundImageUrl === "string" && backgroundImageUrl.trim()
      ? backgroundImageUrl.trim()
      : DEFAULT_LAB_PEOPLE_BG;
  const safePrimaryImageUrl = primaryImageUrl.replace(/"/g, "%22");
  const safeFallbackImageUrl = DEFAULT_LAB_PEOPLE_BG.replace(/"/g, "%22");

  const accentHex = normalizeHexColor(accentColorOverride ?? "");
  const accentColor = accentHex ?? template.accentColor;
  const borderColor = accentHex ? hexToRgba(accentHex, 0.52) : template.borderColor;
  const outlineShadow = accentHex
    ? `0 0 0 1px ${hexToRgba(accentHex, 0.56)}, 0 0 0 2px ${hexToRgba(
        accentHex,
        0.14,
      )}, 0 0 24px ${hexToRgba(accentHex, 0.20)}`
    : template.outlineShadow;
  const glowColor = accentHex ? hexToRgba(accentHex, 0.20) : template.glowColor;
  const chipBackground = accentHex ? hexToRgba(accentHex, 0.20) : template.chipBackground;
  const chipTextColor = accentHex ? accentHex : template.chipTextColor;

  return {
    cardBackground: `${template.backgroundOverlay}, url("${safePrimaryImageUrl}") center / cover no-repeat, url("${safeFallbackImageUrl}") center / cover no-repeat`,
    borderColor,
    outlineShadow,
    accentColor,
    glowColor,
    chipBackground,
    chipTextColor,
  };
}

function normalizeHexColor(raw: string): string | null {
  const value = raw.trim();
  const short = value.match(/^#([0-9a-fA-F]{3})$/);
  if (short) {
    const [r, g, b] = short[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  const full = value.match(/^#([0-9a-fA-F]{6})$/);
  if (!full) return null;
  return `#${full[1].toUpperCase()}`;
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return `rgba(255,255,255,${alpha})`;
  const r = Number.parseInt(normalized.slice(1, 3), 16);
  const g = Number.parseInt(normalized.slice(3, 5), 16);
  const b = Number.parseInt(normalized.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
