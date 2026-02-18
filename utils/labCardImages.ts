type LabImageSource = {
  id: string;
  title: string;
  cover_image_url?: string | null;
  image_url?: string | null;
  background_image_url?: string | null;
};

// Option A: map by lab ID (recommended, stable)
const LAB_IMAGE_BY_ID: Record<string, string> = {
  // "uuid-del-lab": "/labs/storytelling.png",
};

// Option B: map by title (useful while defining IDs)
const LAB_IMAGE_BY_TITLE: Record<string, string> = {
  // "storytelling basico": "/labs/storytelling.png",
};

export function resolveLabCardImage(lab: LabImageSource): string | null {
  const dbImage = firstNonEmpty([
    lab.cover_image_url,
    lab.image_url,
    lab.background_image_url,
  ]);
  if (dbImage) return dbImage;

  const imageById = LAB_IMAGE_BY_ID[lab.id];
  if (imageById) return imageById;

  const imageByTitle = LAB_IMAGE_BY_TITLE[normalizeTitle(lab.title)];
  if (imageByTitle) return imageByTitle;

  return `/labs/${toSlug(lab.title)}.png`;
}

function normalizeTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function toSlug(title: string): string {
  return normalizeTitle(title)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function firstNonEmpty(values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}
