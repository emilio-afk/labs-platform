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
          ? "border border-[var(--ast-sky)]/45 bg-[var(--ast-indigo)]/40 text-[var(--ast-sky)] hover:bg-[var(--ast-indigo)]/65"
          : "border border-[var(--ast-mint)]/60 bg-[var(--ast-mint)]/15 text-[var(--ast-mint)] hover:bg-[var(--ast-mint)]/25"
      }`}
    >
      {inCart ? "Quitar del carrito" : "Agregar al carrito"}
    </button>
  );
}
