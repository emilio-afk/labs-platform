"use client";

import { useState } from "react";

type PurchasePlaceholderProps = {
  labId: string;
  labTitle: string;
  prices: Array<{
    currency: "USD" | "MXN";
    amountCents: number;
  }>;
};

type CheckoutResponse = {
  url?: string;
  error?: string;
};

export default function PurchasePlaceholder({
  labId,
  labTitle,
  prices,
}: PurchasePlaceholderProps) {
  const [coupon, setCoupon] = useState("");
  const defaultCurrency: "USD" | "MXN" = prices.some((p) => p.currency === "USD")
    ? "USD"
    : prices.some((p) => p.currency === "MXN")
      ? "MXN"
      : "USD";
  const [currency, setCurrency] = useState<"USD" | "MXN">(defaultCurrency);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const selectedPrice = prices.find((price) => price.currency === currency) ?? null;

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
          <option value="USD" disabled={!prices.some((price) => price.currency === "USD")}>
            USD
          </option>
          <option value="MXN" disabled={!prices.some((price) => price.currency === "MXN")}>
            MXN
          </option>
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
        disabled={isLoading || !selectedPrice}
        onClick={() => void startCheckout()}
        className="w-full rounded-lg bg-[var(--ast-mint)] text-[var(--ast-black)] py-2 text-sm font-bold hover:bg-[var(--ast-forest)] transition disabled:opacity-70"
      >
        {isLoading
          ? "Redirigiendo a pago..."
          : selectedPrice
            ? `Pagar ahora (${formatMoney(selectedPrice.amountCents, selectedPrice.currency)})`
            : "Precio no disponible"}
      </button>
      <p className="text-[11px] text-[var(--ast-bone)]/70">
        {message ||
          (selectedPrice
            ? `Lab bloqueado: ${labTitle}`
            : `Lab bloqueado: ${labTitle} (sin precio configurado)`)}
      </p>
    </div>
  );
}

function formatMoney(amountCents: number, currency: "USD" | "MXN"): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
  }).format(amountCents / 100);
}
