"use client";

import { useEffect, useState } from "react";

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

type QuoteResponse = {
  ok?: boolean;
  currency?: "USD" | "MXN";
  originalAmountCents?: number;
  discountCents?: number;
  finalAmountCents?: number;
  couponApplied?: boolean;
  freeAccess?: boolean;
  message?: string;
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
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"neutral" | "success" | "error">(
    "neutral",
  );
  const [amountPulse, setAmountPulse] = useState(false);
  const selectedPrice = prices.find((price) => price.currency === currency) ?? null;
  const [pricing, setPricing] = useState<{
    originalAmountCents: number;
    discountCents: number;
    finalAmountCents: number;
    freeAccess: boolean;
  }>({
    originalAmountCents: selectedPrice?.amountCents ?? 0,
    discountCents: 0,
    finalAmountCents: selectedPrice?.amountCents ?? 0,
    freeAccess: false,
  });

  useEffect(() => {
    const baseAmount = selectedPrice?.amountCents ?? 0;
    setPricing({
      originalAmountCents: baseAmount,
      discountCents: 0,
      finalAmountCents: baseAmount,
      freeAccess: false,
    });
    setMessage("");
    setMessageTone("neutral");
  }, [currency, selectedPrice?.amountCents]);

  const startCheckout = async () => {
    setIsLoading(true);
    setMessage("");
    setMessageTone("neutral");

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
        setMessageTone("error");
        return;
      }
      if (!payload.url) {
        setMessage("Stripe no devolvió URL de checkout.");
        setMessageTone("error");
        return;
      }

      window.location.href = payload.url;
    } catch {
      setMessage("Error de red al iniciar checkout.");
      setMessageTone("error");
    } finally {
      setIsLoading(false);
    }
  };

  const applyCoupon = async () => {
    if (!coupon.trim()) {
      setMessage("Escribe un cupón para aplicarlo.");
      setMessageTone("error");
      return;
    }
    if (!selectedPrice) {
      setMessage("No hay precio disponible para este lab.");
      setMessageTone("error");
      return;
    }

    setIsApplyingCoupon(true);
    setMessage("");

    try {
      const response = await fetch("/api/payments/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labId,
          currency,
          couponCode: coupon.trim(),
        }),
      });
      const payload = (await response.json()) as QuoteResponse;

      if (!response.ok || !payload.ok) {
        setMessage(payload.error ?? "No se pudo validar el cupón.");
        setMessageTone("error");
        return;
      }

      const nextPricing = {
        originalAmountCents: payload.originalAmountCents ?? selectedPrice.amountCents,
        discountCents: payload.discountCents ?? 0,
        finalAmountCents: payload.finalAmountCents ?? selectedPrice.amountCents,
        freeAccess: Boolean(payload.freeAccess),
      };
      setPricing(nextPricing);
      setAmountPulse(true);
      setTimeout(() => setAmountPulse(false), 700);
      setMessage(
        payload.message ??
          (nextPricing.freeAccess
            ? "Cupón aplicado: acceso gratuito"
            : "Cupón aplicado"),
      );
      setMessageTone("success");
    } catch {
      setMessage("Error de red validando cupón.");
      setMessageTone("error");
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleCouponChange = (value: string) => {
    const nextCoupon = value.toUpperCase();
    setCoupon(nextCoupon);

    if (!nextCoupon.trim()) {
      const baseAmount = selectedPrice?.amountCents ?? 0;
      setPricing({
        originalAmountCents: baseAmount,
        discountCents: 0,
        finalAmountCents: baseAmount,
        freeAccess: false,
      });
      setMessage("");
      setMessageTone("neutral");
    }
  };

  const showDiscount = pricing.discountCents > 0;

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
          onChange={(e) => handleCouponChange(e.target.value)}
          placeholder="Cupón de descuento"
          className="flex-1 rounded-lg border border-[var(--ast-sky)]/25 bg-[var(--ast-indigo)]/35 px-3 py-2 text-xs"
        />
        <button
          type="button"
          onClick={() => void applyCoupon()}
          disabled={isApplyingCoupon || !selectedPrice}
          className="rounded-lg border border-[var(--ast-sky)]/35 px-3 py-2 text-xs font-semibold text-[var(--ast-sky)] hover:bg-[var(--ast-sky)]/10 transition disabled:opacity-60"
        >
          {isApplyingCoupon ? "Aplicando..." : "Aplicar"}
        </button>
      </div>

      <div
        className={`rounded-lg border border-[var(--ast-sky)]/25 bg-[var(--ast-indigo)]/25 px-3 py-2 text-xs space-y-1 ${amountPulse ? "animate-pulse" : ""}`}
      >
        <div className="flex items-center justify-between text-[var(--ast-bone)]/75">
          <span>Precio base</span>
          <span>{formatMoney(pricing.originalAmountCents, currency)}</span>
        </div>
        {showDiscount && (
          <div className="flex items-center justify-between text-[var(--ast-mint)]">
            <span>Descuento</span>
            <span>-{formatMoney(pricing.discountCents, currency)}</span>
          </div>
        )}
        <div className="flex items-center justify-between text-[var(--ast-bone)] font-bold pt-1 border-t border-white/10">
          <span>Total</span>
          <span>{formatMoney(pricing.finalAmountCents, currency)}</span>
        </div>
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
            ? pricing.freeAccess
              ? "Desbloquear gratis"
              : `Pagar ahora (${formatMoney(pricing.finalAmountCents, currency)})`
            : "Precio no disponible"}
      </button>
      <p
        className={`text-[11px] ${messageTone === "success" ? "text-[var(--ast-mint)]" : messageTone === "error" ? "text-[var(--ast-coral)]" : "text-[var(--ast-bone)]/70"}`}
      >
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
