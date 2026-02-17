"use client";

import { useState } from "react";

type PurchasePlaceholderProps = {
  labTitle: string;
};

export default function PurchasePlaceholder({ labTitle }: PurchasePlaceholderProps) {
  const [coupon, setCoupon] = useState("");
  const [message, setMessage] = useState("");

  const applyCoupon = () => {
    if (!coupon.trim()) {
      setMessage("Escribe un cupón para aplicarlo.");
      return;
    }
    setMessage(
      `Cupón "${coupon.trim()}" registrado (placeholder). Se validará al conectar pagos.`,
    );
  };

  return (
    <div className="mt-4 space-y-2">
      <button
        type="button"
        disabled
        className="w-full rounded-lg bg-[var(--ast-mint)]/80 text-[var(--ast-black)] py-2 text-sm font-bold opacity-80 cursor-not-allowed"
      >
        Pagar (Próximamente)
      </button>
      <div className="flex gap-2">
        <input
          type="text"
          value={coupon}
          onChange={(e) => setCoupon(e.target.value)}
          placeholder="Cupón de descuento"
          className="flex-1 rounded-lg border border-[var(--ast-sky)]/25 bg-[var(--ast-indigo)]/35 px-3 py-2 text-xs"
        />
        <button
          type="button"
          onClick={applyCoupon}
          className="rounded-lg border border-[var(--ast-sky)]/35 px-3 py-2 text-xs font-semibold text-[var(--ast-sky)] hover:bg-[var(--ast-sky)]/10 transition"
        >
          Aplicar
        </button>
      </div>
      <p className="text-[11px] text-[var(--ast-bone)]/70">
        {message || `Lab bloqueado: ${labTitle}`}
      </p>
    </div>
  );
}
