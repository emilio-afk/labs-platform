"use client";

import React from "react";
import type { AdminLab, LabPrice, Coupon } from "../types";
import { formatMoney } from "../utils/formatting";

interface CommerceTabProps {
  labs: AdminLab[];
  selectedLab: string | null;
  handleSelectLab: (labId: string | null) => void;
  pricingMsg: string;
  priceCurrency: "USD" | "MXN";
  setPriceCurrency: (value: "USD" | "MXN") => void;
  priceAmount: string;
  setPriceAmount: (value: string) => void;
  labPrices: LabPrice[];
  couponCode: string;
  setCouponCode: (value: string) => void;
  couponType: "percent" | "fixed";
  setCouponType: (value: "percent" | "fixed") => void;
  couponPercent: string;
  setCouponPercent: (value: string) => void;
  couponAmount: string;
  setCouponAmount: (value: string) => void;
  couponCurrency: "USD" | "MXN";
  setCouponCurrency: (value: "USD" | "MXN") => void;
  couponScope: "all" | "lab";
  setCouponScope: (value: "all" | "lab") => void;
  couponLabId: string | null;
  setCouponLabId: (value: string) => void;
  couponExpiresAt: string;
  setCouponExpiresAt: (value: string) => void;
  coupons: Coupon[];
  savePrice: (e: React.FormEvent<HTMLFormElement>) => void;
  createCoupon: (e: React.FormEvent<HTMLFormElement>) => void;
  toggleCouponActive: (couponId: string, active: boolean) => Promise<void>;
}

export default function CommerceTab({
  labs,
  selectedLab,
  handleSelectLab,
  pricingMsg,
  priceCurrency,
  setPriceCurrency,
  priceAmount,
  setPriceAmount,
  labPrices,
  couponCode,
  setCouponCode,
  couponType,
  setCouponType,
  couponPercent,
  setCouponPercent,
  couponAmount,
  setCouponAmount,
  couponCurrency,
  setCouponCurrency,
  couponScope,
  setCouponScope,
  couponLabId,
  setCouponLabId,
  couponExpiresAt,
  setCouponExpiresAt,
  coupons,
  savePrice,
  createCoupon,
  toggleCouponActive,
}: CommerceTabProps) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-[var(--ast-mint)]/22 bg-[linear-gradient(160deg,rgba(8,20,52,0.88),rgba(4,12,32,0.95))] shadow-[0_24px_48px_rgba(1,5,18,0.55)] before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[linear-gradient(90deg,transparent,rgba(4,164,90,0.7),transparent)]">
      <div className="border-b border-[var(--ast-mint)]/20 bg-[rgba(4,164,90,0.10)] px-6 py-4">
        <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-[var(--ast-mint)]">Módulo 06</p>
        <h2 className="font-[family-name:var(--font-space-grotesk)] text-2xl font-black tracking-tight text-[var(--ui-text)]">
          Comercial
        </h2>
        <p className="mt-0.5 text-[11px] text-[var(--ast-mint)]/65">Configura precios por lab y gestiona cupones de descuento.</p>
      </div>
      <div className="space-y-6 p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded border border-gray-700 p-4 bg-black/30 space-y-3">
          <h3 className="font-semibold text-emerald-200">Configurar precios por lab</h3>
          <div>
            <label className="text-xs text-gray-400">Lab</label>
            <select
              value={selectedLab ?? ""}
              onChange={(e) => handleSelectLab(e.target.value)}
              className="w-full p-2 rounded bg-black border border-gray-600"
            >
              <option value="" disabled>
                Selecciona un lab
              </option>
              {labs.map((lab) => (
                <option key={lab.id} value={lab.id}>
                  {lab.title}
                </option>
              ))}
            </select>
          </div>
          <form onSubmit={savePrice} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              value={priceCurrency}
              onChange={(e) => setPriceCurrency(e.target.value as "USD" | "MXN")}
              className="p-2 rounded bg-black border border-gray-600"
            >
              <option value="USD">USD</option>
              <option value="MXN">MXN</option>
            </select>
            <input
              type="number"
              min={0}
              step="0.01"
              value={priceAmount}
              onChange={(e) => setPriceAmount(e.target.value)}
              placeholder="Monto"
              className="p-2 rounded bg-black border border-gray-600"
            />
            <button
              type="submit"
              className="px-3 py-2 rounded bg-[var(--ast-mint)] hover:bg-[var(--ast-forest)] text-sm font-bold"
            >
              Guardar precio
            </button>
          </form>

          <div className="space-y-2">
            {(labPrices ?? []).map((price) => (
              <div
                key={price.id}
                className="rounded border border-gray-700 p-2 bg-black/30 text-sm flex justify-between"
              >
                <span>{price.currency}</span>
                <span>{formatMoney(price.amount_cents, price.currency)}</span>
              </div>
            ))}
            {labPrices.length === 0 && (
              <p className="text-sm text-gray-400">Sin precios configurados para este lab.</p>
            )}
          </div>
        </div>

        <div className="rounded border border-gray-700 p-4 bg-black/30 space-y-3">
          <h3 className="font-semibold text-emerald-200">Crear cupón</h3>
          <form onSubmit={createCoupon} className="space-y-3">
            <input
              type="text"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              placeholder="Código (ej: ASTRO20)"
              className="w-full p-2 rounded bg-black border border-gray-600"
              required
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select
                value={couponType}
                onChange={(e) =>
                  setCouponType(e.target.value as "percent" | "fixed")
                }
                className="p-2 rounded bg-black border border-gray-600"
              >
                <option value="percent">% Porcentaje</option>
                <option value="fixed">Monto fijo</option>
              </select>
              <select
                value={couponScope}
                onChange={(e) => setCouponScope(e.target.value as "all" | "lab")}
                className="p-2 rounded bg-black border border-gray-600"
              >
                <option value="all">Aplica a todos</option>
                <option value="lab">Solo un lab</option>
              </select>
            </div>

            {couponType === "percent" ? (
              <input
                type="number"
                min={1}
                max={100}
                value={couponPercent}
                onChange={(e) => setCouponPercent(e.target.value)}
                placeholder="Porcentaje (1-100)"
                className="w-full p-2 rounded bg-black border border-gray-600"
                required
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={couponAmount}
                  onChange={(e) => setCouponAmount(e.target.value)}
                  placeholder="Monto descuento"
                  className="p-2 rounded bg-black border border-gray-600"
                  required
                />
                <select
                  value={couponCurrency}
                  onChange={(e) =>
                    setCouponCurrency(e.target.value as "USD" | "MXN")
                  }
                  className="p-2 rounded bg-black border border-gray-600"
                >
                  <option value="USD">USD</option>
                  <option value="MXN">MXN</option>
                </select>
              </div>
            )}

            {couponScope === "lab" && (
              <select
                value={couponLabId || selectedLab || ""}
                onChange={(e) => setCouponLabId(e.target.value)}
                className="w-full p-2 rounded bg-black border border-gray-600"
                required
              >
                <option value="" disabled>
                  Selecciona lab del cupón
                </option>
                {labs.map((lab) => (
                  <option key={lab.id} value={lab.id}>
                    {lab.title}
                  </option>
                ))}
              </select>
            )}

            <input
              type="datetime-local"
              value={couponExpiresAt}
              onChange={(e) => setCouponExpiresAt(e.target.value)}
              className="w-full p-2 rounded bg-black border border-gray-600"
            />

            <button
              type="submit"
              className="w-full px-3 py-2 rounded bg-[var(--ast-mint)] hover:bg-[var(--ast-forest)] text-sm font-bold"
            >
              Crear cupón
            </button>
          </form>
        </div>
      </div>

      <div className="rounded border border-gray-700 p-4 bg-black/30">
        <h3 className="font-semibold text-emerald-200 mb-3">Cupones existentes</h3>
        <div className="space-y-2 max-h-72 overflow-auto pr-1">
          {coupons.map((coupon) => (
            <div
              key={coupon.id}
              className="rounded border border-gray-700 p-3 bg-black/30 flex items-start justify-between gap-3"
            >
              <div className="text-sm">
                <p className="font-semibold text-gray-100">{coupon.code}</p>
                <p className="text-xs text-gray-400">
                  {coupon.discount_type === "percent"
                    ? `${coupon.percent_off ?? 0}%`
                    : `${formatMoney(coupon.amount_off_cents ?? 0, coupon.currency ?? "USD")} fijo`}
                  {" · "}
                  {coupon.lab_id ? "Lab específico" : "Global"}
                  {" · "}
                  {coupon.is_active ? "Activo" : "Inactivo"}
                </p>
                {coupon.expires_at && (
                  <p className="text-[11px] text-gray-500">
                    Expira: {new Date(coupon.expires_at).toLocaleString()}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => void toggleCouponActive(coupon.id, !coupon.is_active)}
                className={`px-3 py-1 text-xs rounded ${
                  coupon.is_active
                    ? "bg-[var(--ast-rust)]/70 hover:bg-[var(--ast-rust)]"
                    : "bg-[var(--ast-forest)] hover:bg-[var(--ast-mint)]"
                }`}
              >
                {coupon.is_active ? "Desactivar" : "Activar"}
              </button>
            </div>
          ))}
          {coupons.length === 0 && (
            <p className="text-sm text-gray-400">No hay cupones todavía.</p>
          )}
        </div>
      </div>

      {pricingMsg && <p className="text-[12px] font-medium text-[var(--ast-yellow)]">◈ {pricingMsg}</p>}
      </div>
    </section>
  );
}
