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

  return (
    <section className="space-y-4 rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-5 shadow-[0_16px_30px_rgba(1,7,22,0.45)] md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-space-grotesk)] text-xl font-bold text-[var(--ui-text)] md:text-2xl">
            Carrito
          </h2>
          <p className="text-xs text-[var(--ui-muted)] md:text-sm">
            Compra varios labs en un solo pago.
          </p>
        </div>
        <div className="rounded-full border border-[var(--ui-border)] bg-[var(--ui-surface-soft)] px-3 py-1 text-xs text-[var(--ui-text)]">
          {selectedLabs.length} {selectedLabs.length === 1 ? "lab" : "labs"}
        </div>
      </div>

      {selectedLabs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--ui-border)] bg-[var(--ui-surface-soft)] px-4 py-3 text-sm text-[var(--ui-muted)]">
          Tu carrito está vacío. Agrega labs desde las tarjetas bloqueadas.
        </div>
      ) : (
        <>
          <div className="space-y-2 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface-soft)] p-3">
            {selectedLines.map((line) => (
              <div
                key={line.id}
                className="flex items-center justify-between gap-3 rounded-md border border-[var(--ui-border)] bg-[rgba(2,9,24,0.7)] px-3 py-2"
              >
                <div>
                  <p className="text-sm font-semibold text-[var(--ui-text)]">{line.title}</p>
                  <p className="text-xs text-[var(--ui-muted)]">
                    {line.amountCents == null
                      ? "Sin precio en esta moneda"
                      : formatMoney(line.amountCents, currency)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    toggleCartLab(line.id);
                  }}
                  className="rounded-md border border-[var(--ast-coral)]/45 px-2 py-1 text-xs text-[var(--ast-yellow)] transition hover:bg-[rgba(246,109,58,0.18)]"
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={currency}
              onChange={(event) => setCurrency(event.target.value as Currency)}
              className="rounded-lg border border-[var(--ui-border)] bg-[rgba(2,9,24,0.7)] px-3 py-2 text-xs text-[var(--ui-text)]"
            >
              <option value="USD" disabled={!availableCurrencies.includes("USD")}>
                USD
              </option>
              <option value="MXN" disabled={!availableCurrencies.includes("MXN")}>
                MXN
              </option>
            </select>
            <input
              type="text"
              value={coupon}
              onChange={(event) => handleCouponChange(event.target.value)}
              placeholder="Cupón de descuento"
              className="min-w-[180px] flex-1 rounded-lg border border-[var(--ui-border)] bg-[rgba(2,9,24,0.7)] px-3 py-2 text-xs text-[var(--ui-text)] placeholder:text-[var(--ui-muted)]"
            />
            <button
              type="button"
              onClick={() => void applyCoupon()}
              disabled={isApplyingCoupon}
              className="rounded-lg border border-[var(--ui-border)] bg-[rgba(2,9,24,0.7)] px-3 py-2 text-xs font-semibold text-[var(--ui-text)] transition hover:border-[var(--ui-secondary)] hover:bg-[var(--ui-surface-soft)] disabled:opacity-60"
            >
              {isApplyingCoupon ? "Aplicando..." : "Aplicar"}
            </button>
          </div>

          <div
            className={`space-y-1 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface-soft)] px-3 py-2 text-xs ${amountPulse ? "animate-pulse" : ""}`}
          >
            <div className="flex items-center justify-between text-[var(--ui-muted)]">
              <span>Precio base</span>
              <span>{formatMoney(pricing.originalAmountCents, currency)}</span>
            </div>
            {pricing.discountCents > 0 && (
              <div className="flex items-center justify-between text-[var(--ui-success)]">
                <span>Descuento</span>
                <span>-{formatMoney(pricing.discountCents, currency)}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-[var(--ui-border)] pt-1 font-bold text-[var(--ui-text)]">
              <span>Total</span>
              <span>{formatMoney(pricing.finalAmountCents, currency)}</span>
            </div>
          </div>

          <button
            type="button"
            disabled={isLoading || availableCurrencies.length === 0 || missingPriceLabs.length > 0}
            onClick={() => void startCheckout()}
            className="w-full rounded-lg bg-[var(--ui-accent)] py-2 text-sm font-semibold text-[var(--ast-black)] transition hover:bg-[var(--ast-forest)] disabled:opacity-70"
          >
            {isLoading
              ? "Redirigiendo a pago..."
              : pricing.freeAccess
                ? "Desbloquear carrito gratis"
                : `Pagar carrito (${formatMoney(pricing.finalAmountCents, currency)})`}
          </button>

          <p
            className={`text-[11px] ${
              messageTone === "success"
                ? "text-[var(--ui-success)]"
                : messageTone === "error"
                  ? "text-[var(--ui-accent)]"
                  : "text-[var(--ui-muted)]"
            }`}
          >
            {message ||
              (missingPriceLabs.length > 0
                ? "Elige labs que compartan la misma moneda."
                : "Tip: aplica un cupón antes de pagar.")}
          </p>
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
