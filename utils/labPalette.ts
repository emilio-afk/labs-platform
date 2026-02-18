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

export function getLabPalette(seed: string, backgroundImageUrl?: string | null): LabPalette {
  if (!seed) {
    return materializePalette(LAB_PALETTES[0], backgroundImageUrl);
  }
  const index = hashSeed(seed) % LAB_PALETTES.length;
  return materializePalette(LAB_PALETTES[index], backgroundImageUrl);
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
): LabPalette {
  const primaryImageUrl =
    typeof backgroundImageUrl === "string" && backgroundImageUrl.trim()
      ? backgroundImageUrl.trim()
      : DEFAULT_LAB_PEOPLE_BG;
  const safePrimaryImageUrl = primaryImageUrl.replace(/"/g, "%22");
  const safeFallbackImageUrl = DEFAULT_LAB_PEOPLE_BG.replace(/"/g, "%22");
  return {
    cardBackground: `${template.backgroundOverlay}, url("${safePrimaryImageUrl}") center / cover no-repeat, url("${safeFallbackImageUrl}") center / cover no-repeat`,
    borderColor: template.borderColor,
    outlineShadow: template.outlineShadow,
    accentColor: template.accentColor,
    glowColor: template.glowColor,
    chipBackground: template.chipBackground,
    chipTextColor: template.chipTextColor,
  };
}
