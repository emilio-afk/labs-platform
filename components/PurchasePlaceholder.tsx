"use client";

import { useState } from "react";

type PurchasePlaceholderProps = {
  labId: string;
  labTitle: string;
};

type CheckoutResponse = {
  url?: string;
  error?: string;
};

export default function PurchasePlaceholder({
  labId,
  labTitle,
}: PurchasePlaceholderProps) {
  const [coupon, setCoupon] = useState("");
  const [currency, setCurrency] = useState<"USD" | "MXN">("USD");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  const startCheckout = async () => {
    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labId,
          currency,
          couponCode: coupon.trim() || null,
        }),
      });
      const payload = (await response.json()) as CheckoutResponse;

      if (!response.ok) {
        setMessage(payload.error ?? "No se pudo iniciar el pago.");
        return;
      }
      if (!payload.url) {
        setMessage("Stripe no devolvió URL de checkout.");
        return;
      }

      window.location.href = payload.url;
    } catch {
      setMessage("Error de red al iniciar checkout.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-4 space-y-2">
      <div className="flex gap-2">
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value as "USD" | "MXN")}
          className="rounded-lg border border-[var(--ast-sky)]/25 bg-[var(--ast-indigo)]/35 px-3 py-2 text-xs"
        >
          <option value="USD">USD</option>
          <option value="MXN">MXN</option>
        </select>
        <input
          type="text"
          value={coupon}
          onChange={(e) => setCoupon(e.target.value.toUpperCase())}
          placeholder="Cupón de descuento"
          className="flex-1 rounded-lg border border-[var(--ast-sky)]/25 bg-[var(--ast-indigo)]/35 px-3 py-2 text-xs"
        />
      </div>

      <button
        type="button"
        disabled={isLoading}
        onClick={() => void startCheckout()}
        className="w-full rounded-lg bg-[var(--ast-mint)] text-[var(--ast-black)] py-2 text-sm font-bold hover:bg-[var(--ast-forest)] transition disabled:opacity-70"
      >
        {isLoading ? "Redirigiendo a pago..." : "Pagar ahora"}
      </button>
      <p className="text-[11px] text-[var(--ast-bone)]/70">
        {message || `Lab bloqueado: ${labTitle}`}
      </p>
    </div>
  );
}
