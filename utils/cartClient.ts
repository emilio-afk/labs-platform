"use client";

export const CART_STORAGE_KEY = "astrolab_cart_lab_ids";
export const CART_EVENT = "astrolab-cart-changed";

export function readCartLabIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string")
      .slice(0, 200);
  } catch {
    return [];
  }
}

export function writeCartLabIds(labIds: string[]) {
  if (typeof window === "undefined") return;
  const unique = Array.from(new Set(labIds.filter(Boolean)));
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(unique));
  window.dispatchEvent(new Event(CART_EVENT));
}

export function toggleCartLab(labId: string): string[] {
  const current = readCartLabIds();
  const next = current.includes(labId)
    ? current.filter((item) => item !== labId)
    : [...current, labId];
  writeCartLabIds(next);
  return next;
}

export function removeLabsFromCart(labIdsToRemove: string[]) {
  const removeSet = new Set(labIdsToRemove);
  const next = readCartLabIds().filter((item) => !removeSet.has(item));
  writeCartLabIds(next);
}

export function clearCart() {
  writeCartLabIds([]);
}
