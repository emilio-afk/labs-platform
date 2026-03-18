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
      className={`inline-flex w-full items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-semibold transition-all duration-200 active:scale-[0.99] ${
        inCart
          ? "border-[var(--ui-border)] bg-[var(--ui-surface-soft)] text-[var(--ui-muted)] hover:border-red-400/30 hover:bg-[rgba(200,40,40,0.08)] hover:text-red-300"
          : "border-[var(--ast-mint)]/52 bg-[rgba(4,164,90,0.13)] text-[var(--ast-mint)] hover:bg-[rgba(4,164,90,0.22)]"
      }`}
    >
      <span className="text-base leading-none">{inCart ? "−" : "+"}</span>
      {inCart ? "Quitar del carrito" : "Agregar al carrito"}
    </button>
  );
}
