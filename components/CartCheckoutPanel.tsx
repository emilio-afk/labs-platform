"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CART_EVENT,
  readCartLabIds,
  toggleCartLab,
} from "@/utils/cartClient";

type Currency = "USD" | "MXN";

type CartLab = {
  id: string;
  title: string;
  prices: Array<{
    currency: Currency;
    amountCents: number;
  }>;
};

type CartCheckoutPanelProps = {
  labs: CartLab[];
};

type CheckoutResponse = {
  url?: string;
  error?: string;
};

type QuoteResponse = {
  ok?: boolean;
  currency?: Currency;
  originalAmountCents?: number;
  discountCents?: number;
  finalAmountCents?: number;
  couponApplied?: boolean;
  freeAccess?: boolean;
  message?: string;
  error?: string;
};

export default function CartCheckoutPanel({ labs }: CartCheckoutPanelProps) {
  const [cartLabIds, setCartLabIds] = useState<string[]>([]);
  const [currency, setCurrency] = useState<Currency>("USD");
  const [coupon, setCoupon] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"neutral" | "success" | "error">(
    "neutral",
  );
  const [amountPulse, setAmountPulse] = useState(false);

  const labsById = useMemo(() => {
    return new Map(labs.map((lab) => [lab.id, lab]));
  }, [labs]);

  useEffect(() => {
    const sync = () => {
      const filtered = readCartLabIds().filter((id) => labsById.has(id));
      setCartLabIds(filtered);
    };

    sync();
    window.addEventListener(CART_EVENT, sync);
    return () => {
      window.removeEventListener(CART_EVENT, sync);
    };
  }, [labsById]);

  const selectedLabs = useMemo(() => {
    return cartLabIds
      .map((id) => labsById.get(id))
      .filter((lab): lab is CartLab => Boolean(lab));
  }, [cartLabIds, labsById]);

  const availableCurrencies = useMemo(() => {
    if (selectedLabs.length === 0) return [] as Currency[];
    const canUseUsd = selectedLabs.every((lab) =>
      lab.prices.some((price) => price.currency === "USD"),
    );
    const canUseMxn = selectedLabs.every((lab) =>
      lab.prices.some((price) => price.currency === "MXN"),
    );
    const result: Currency[] = [];
    if (canUseUsd) result.push("USD");
    if (canUseMxn) result.push("MXN");
    return result;
  }, [selectedLabs]);

  useEffect(() => {
    if (availableCurrencies.length === 0) return;
    if (!availableCurrencies.includes(currency)) {
      setCurrency(availableCurrencies[0]);
    }
  }, [availableCurrencies, currency]);

  const selectedLines = useMemo(() => {
    return selectedLabs.map((lab) => {
      const price = lab.prices.find((candidate) => candidate.currency === currency) ?? null;
      return {
        id: lab.id,
        title: lab.title,
        amountCents: price?.amountCents ?? null,
      };
    });
  }, [selectedLabs, currency]);

  const missingPriceLabs = selectedLines.filter((line) => line.amountCents == null);
  const baseAmountCents = selectedLines.reduce(
    (sum, line) => sum + (line.amountCents ?? 0),
    0,
  );

  const [pricing, setPricing] = useState({
    originalAmountCents: 0,
    discountCents: 0,
    finalAmountCents: 0,
    freeAccess: false,
  });

  useEffect(() => {
    setPricing({
      originalAmountCents: baseAmountCents,
      discountCents: 0,
      finalAmountCents: baseAmountCents,
      freeAccess: baseAmountCents === 0 && selectedLabs.length > 0,
    });
    setMessage("");
    setMessageTone("neutral");
  }, [baseAmountCents, selectedLabs.length, currency]);

  const applyCoupon = async () => {
    if (!coupon.trim()) {
      setMessage("Escribe un cupón para aplicarlo.");
      setMessageTone("error");
      return;
    }
    if (selectedLabs.length === 0) {
      setMessage("Agrega al menos un lab al carrito.");
      setMessageTone("error");
      return;
    }
    if (availableCurrencies.length === 0 || missingPriceLabs.length > 0) {
      setMessage("Tus labs no comparten una moneda de pago.");
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
          labIds: selectedLabs.map((lab) => lab.id),
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
        originalAmountCents: payload.originalAmountCents ?? baseAmountCents,
        discountCents: payload.discountCents ?? 0,
        finalAmountCents: payload.finalAmountCents ?? baseAmountCents,
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

  const startCheckout = async () => {
    if (selectedLabs.length === 0) {
      setMessage("Agrega al menos un lab al carrito.");
      setMessageTone("error");
      return;
    }
    if (availableCurrencies.length === 0 || missingPriceLabs.length > 0) {
      setMessage("Tus labs no comparten una moneda de pago.");
      setMessageTone("error");
      return;
    }

    setIsLoading(true);
    setMessage("");
    setMessageTone("neutral");

    try {
      const response = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labIds: selectedLabs.map((lab) => lab.id),
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

  const handleCouponChange = (value: string) => {
    const nextCoupon = value.toUpperCase();
    setCoupon(nextCoupon);

    if (!nextCoupon.trim()) {
      setPricing({
        originalAmountCents: baseAmountCents,
        discountCents: 0,
        finalAmountCents: baseAmountCents,
        freeAccess: baseAmountCents === 0 && selectedLabs.length > 0,
      });
      setMessage("");
      setMessageTone("neutral");
    }
  };

  const couponApplied = messageTone === "success" && pricing.discountCents > 0;

  return (
    <section className="space-y-4">
      {/* Items in cart */}
      <div className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] shadow-[0_12px_28px_rgba(1,7,22,0.4)]">
        <div className="flex items-center justify-between border-b border-[var(--ui-border)] px-5 py-4">
          <div>
            <h2 className="font-[family-name:var(--font-space-grotesk)] text-xl font-bold text-[var(--ui-text)]">
              Tu carrito
            </h2>
            <p className="text-xs text-[var(--ui-muted)]">
              {selectedLabs.length === 0
                ? "Sin labs seleccionados"
                : `${selectedLabs.length} ${selectedLabs.length === 1 ? "lab" : "labs"} seleccionado${selectedLabs.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          {selectedLabs.length > 0 && (
            <span className="rounded-full border border-[var(--ui-border)] bg-[var(--ui-surface-soft)] px-3 py-1 text-sm font-bold text-[var(--ui-text)]">
              {selectedLabs.length}
            </span>
          )}
        </div>

        {selectedLabs.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-4xl">🛒</p>
            <p className="mt-3 font-semibold text-[var(--ui-text)]">Carrito vacío</p>
            <p className="mt-1 text-sm text-[var(--ui-muted)]">
              Agrega labs desde el catálogo para comprarlos aquí.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--ui-border)]">
            {selectedLines.map((line) => (
              <div
                key={line.id}
                className="flex items-center gap-4 px-5 py-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[var(--ui-text)]">{line.title}</p>
                  <p className="mt-0.5 text-sm text-[var(--ui-muted)]">
                    {line.amountCents == null
                      ? "Sin precio en esta moneda"
                      : formatMoney(line.amountCents, currency)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleCartLab(line.id)}
                  aria-label={`Quitar ${line.title} del carrito`}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--ui-border)] text-[var(--ui-muted)] transition hover:border-red-400/40 hover:bg-[rgba(200,40,40,0.1)] hover:text-red-300 active:scale-95"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedLabs.length > 0 && (
        <>
          {/* Currency + coupon */}
          <div className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-5 shadow-[0_8px_20px_rgba(1,7,22,0.3)]">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--ui-muted)]">
              Moneda
            </p>
            <div className="flex gap-2">
              {(["USD", "MXN"] as Currency[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => availableCurrencies.includes(c) && setCurrency(c)}
                  disabled={!availableCurrencies.includes(c)}
                  className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-all duration-150 ${
                    currency === c
                      ? "border-[var(--ui-primary)]/65 bg-[rgba(10,86,198,0.2)] text-[var(--ast-sky)]"
                      : availableCurrencies.includes(c)
                        ? "border-[var(--ui-border)] bg-transparent text-[var(--ui-muted)] hover:border-[var(--ui-border)]/80 hover:text-[var(--ui-text)]"
                        : "border-[var(--ui-border)]/40 bg-transparent text-[var(--ui-muted)]/40 cursor-not-allowed"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-[var(--ui-muted)]">
              Cupón de descuento
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={coupon}
                onChange={(event) => handleCouponChange(event.target.value)}
                placeholder="Escribe tu cupón..."
                className={`flex-1 rounded-lg border bg-[var(--ui-surface-soft)] px-3 py-2 text-sm text-[var(--ui-text)] placeholder:text-[var(--ui-muted)] outline-none transition focus:border-[var(--ui-primary)] ${
                  couponApplied
                    ? "border-[var(--ui-success)]/50"
                    : "border-[var(--ui-border)]"
                }`}
              />
              <button
                type="button"
                onClick={() => void applyCoupon()}
                disabled={isApplyingCoupon || !coupon.trim()}
                className="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface-soft)] px-4 py-2 text-sm font-semibold text-[var(--ui-text)] transition hover:border-[var(--ui-primary)]/50 hover:text-[var(--ast-sky)] disabled:opacity-50 active:scale-95"
              >
                {isApplyingCoupon ? "..." : "Aplicar"}
              </button>
            </div>
            {message && (
              <p className={`mt-2 text-xs font-medium ${
                messageTone === "success"
                  ? "text-[var(--ui-success)]"
                  : messageTone === "error"
                    ? "text-red-300"
                    : "text-[var(--ui-muted)]"
              }`}>
                {message}
              </p>
            )}
          </div>

          {/* Pricing summary + CTA */}
          <div className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-5 shadow-[0_8px_20px_rgba(1,7,22,0.3)]">
            <div className={`space-y-2 transition-all ${amountPulse ? "animate-pulse" : ""}`}>
              <div className="flex items-center justify-between text-sm text-[var(--ui-muted)]">
                <span>Subtotal</span>
                <span>{formatMoney(pricing.originalAmountCents, currency)}</span>
              </div>
              {pricing.discountCents > 0 && (
                <div className="flex items-center justify-between text-sm font-semibold text-[var(--ui-success)]">
                  <span>Descuento cupón</span>
                  <span>−{formatMoney(pricing.discountCents, currency)}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-[var(--ui-border)] pt-2 font-bold text-[var(--ui-text)]">
                <span>Total</span>
                <span className="text-lg">{formatMoney(pricing.finalAmountCents, currency)}</span>
              </div>
            </div>

            {missingPriceLabs.length > 0 && (
              <p className="mt-3 rounded-lg border border-[rgba(240,120,60,0.3)] bg-[rgba(200,60,20,0.1)] px-3 py-2 text-xs text-[#f5b090]">
                Algunos labs no tienen precio en {currency}. Cambia de moneda.
              </p>
            )}

            <button
              type="button"
              disabled={isLoading || availableCurrencies.length === 0 || missingPriceLabs.length > 0}
              onClick={() => void startCheckout()}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--ui-accent)] py-3.5 text-base font-bold text-[var(--ast-black)] transition hover:bg-[var(--ast-forest)] disabled:opacity-60 active:scale-[0.99]"
            >
              {isLoading ? (
                <>
                  <span className="animate-spin">⟳</span>
                  Redirigiendo al pago...
                </>
              ) : pricing.freeAccess ? (
                "Desbloquear gratis"
              ) : (
                <>
                  Pagar {formatMoney(pricing.finalAmountCents, currency)}
                  <span aria-hidden="true">→</span>
                </>
              )}
            </button>
            <p className="mt-2.5 text-center text-[11px] text-[var(--ui-muted)]">
              Procesado de forma segura por Stripe
            </p>
          </div>
        </>
      )}
    </section>
  );
}

function formatMoney(amountCents: number, currency: Currency): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
  }).format(amountCents / 100);
}
