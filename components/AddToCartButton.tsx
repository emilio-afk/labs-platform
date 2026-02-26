"use client";

import { useEffect, useState } from "react";
import { CART_EVENT, readCartLabIds, toggleCartLab } from "@/utils/cartClient";

type AddToCartButtonProps = {
  labId: string;
};

export default function AddToCartButton({ labId }: AddToCartButtonProps) {
  const [inCart, setInCart] = useState(false);

  useEffect(() => {
    const sync = () => {
      setInCart(readCartLabIds().includes(labId));
    };

    sync();
    window.addEventListener(CART_EVENT, sync);
    return () => {
      window.removeEventListener(CART_EVENT, sync);
    };
  }, [labId]);

  return (
    <button
      type="button"
      onClick={() => {
        const next = toggleCartLab(labId);
        setInCart(next.includes(labId));
      }}
      className={`w-full rounded-lg py-2 text-sm font-semibold transition ${
        inCart
          ? "border border-[var(--ui-border)] bg-[var(--ui-surface-soft)] text-[var(--ui-text)] hover:bg-[rgba(185,214,254,0.14)]"
          : "border border-[var(--ast-mint)]/55 bg-[rgba(4,164,90,0.14)] text-[var(--ast-mint)] hover:bg-[rgba(4,164,90,0.22)]"
      }`}
    >
      {inCart ? "Quitar del carrito" : "Agregar al carrito"}
    </button>
  );
}
