import { useCallback, useEffect, useState } from "react";
import type { AdminTab, Coupon, LabPrice } from "../types";

export function useCommerceTab(
  selectedLab: string | null,
  activeTab: AdminTab,
) {
  const [pricingMsg, setPricingMsg] = useState("");
  const [commercialRefreshTick, setCommercialRefreshTick] = useState(0);
  const [priceCurrency, setPriceCurrency] = useState<"USD" | "MXN">("USD");
  const [priceAmount, setPriceAmount] = useState("");
  const [labPrices, setLabPrices] = useState<LabPrice[]>([]);

  const [couponCode, setCouponCode] = useState("");
  const [couponType, setCouponType] = useState<"percent" | "fixed">("percent");
  const [couponPercent, setCouponPercent] = useState("");
  const [couponAmount, setCouponAmount] = useState("");
  const [couponCurrency, setCouponCurrency] = useState<"USD" | "MXN">("USD");
  const [couponScope, setCouponScope] = useState<"all" | "lab">("all");
  const [couponLabId, setCouponLabId] = useState<string>(selectedLab ?? "");
  const [couponExpiresAt, setCouponExpiresAt] = useState("");
  const [coupons, setCoupons] = useState<Coupon[]>([]);

  // Sync couponLabId when selectedLab changes
  useEffect(() => {
    if (selectedLab) setCouponLabId(selectedLab);
  }, [selectedLab]);

  const refresh = useCallback(() => setCommercialRefreshTick((prev) => prev + 1), []);

  useEffect(() => {
    let active = true;

    const loadCommercialData = async () => {
      if (activeTab !== "commerce") return;

      if (!selectedLab) {
        if (active) {
          setLabPrices([]);
          setCoupons([]);
          setPricingMsg("Selecciona un lab para configurar precios/comercial.");
        }
        return;
      }

      const [pricesRes, couponsRes] = await Promise.all([
        fetch(`/api/admin/pricing?labId=${selectedLab}`),
        fetch("/api/admin/coupons"),
      ]);

      const pricesPayload = (await pricesRes.json()) as { prices?: LabPrice[]; error?: string };
      const couponsPayload = (await couponsRes.json()) as { coupons?: Coupon[]; error?: string };

      if (!active) return;

      if (!pricesRes.ok) {
        setPricingMsg(pricesPayload.error ?? "No se pudieron cargar precios");
      } else {
        setLabPrices(pricesPayload.prices ?? []);
        setPricingMsg("");
      }

      if (!couponsRes.ok) {
        setPricingMsg(couponsPayload.error ?? "No se pudieron cargar cupones/comercial");
      } else {
        setCoupons(couponsPayload.coupons ?? []);
      }
    };

    void loadCommercialData();
    return () => {
      active = false;
    };
  }, [activeTab, commercialRefreshTick, selectedLab]);

  const savePrice = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedLab) {
      setPricingMsg("Selecciona un lab.");
      return;
    }

    const amount = Number(priceAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPricingMsg("Monto inválido.");
      return;
    }

    setPricingMsg("Guardando precio...");
    const response = await fetch("/api/admin/pricing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ labId: selectedLab, currency: priceCurrency, amount, isActive: true }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setPricingMsg(payload.error ?? "No se pudo guardar precio");
      return;
    }

    setPricingMsg("Precio guardado");
    setPriceAmount("");
    refresh();
  };

  const createCoupon = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPricingMsg("Guardando cupón...");

    const response = await fetch("/api/admin/coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: couponCode,
        discountType: couponType,
        percentOff: couponType === "percent" ? Number(couponPercent) : null,
        amountOff: couponType === "fixed" ? Number(couponAmount) : null,
        currency: couponType === "fixed" ? couponCurrency : null,
        labId: couponScope === "lab" ? couponLabId || selectedLab : null,
        expiresAt: couponExpiresAt || null,
        isActive: true,
      }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setPricingMsg(payload.error ?? "No se pudo crear cupón");
      return;
    }

    setCouponCode("");
    setCouponPercent("");
    setCouponAmount("");
    setCouponExpiresAt("");
    setPricingMsg("Cupón creado");
    refresh();
  };

  const toggleCouponActive = async (couponId: string, nextValue: boolean) => {
    setPricingMsg("Actualizando cupón...");
    const response = await fetch("/api/admin/coupons", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: couponId, isActive: nextValue }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setPricingMsg(payload.error ?? "No se pudo actualizar cupón");
      return;
    }
    setPricingMsg(nextValue ? "Cupón activado" : "Cupón desactivado");
    refresh();
  };

  return {
    pricingMsg,
    priceCurrency, setPriceCurrency,
    priceAmount, setPriceAmount,
    labPrices,
    couponCode, setCouponCode,
    couponType, setCouponType,
    couponPercent, setCouponPercent,
    couponAmount, setCouponAmount,
    couponCurrency, setCouponCurrency,
    couponScope, setCouponScope,
    couponLabId, setCouponLabId,
    couponExpiresAt, setCouponExpiresAt,
    coupons,
    refresh,
    savePrice,
    createCoupon,
    toggleCouponActive,
  };
}
