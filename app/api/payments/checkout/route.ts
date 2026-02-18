import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";

type CheckoutPayload = {
  labId?: unknown;
  currency?: unknown;
  couponCode?: unknown;
};

type LabPriceRow = {
  lab_id: string;
  currency: "USD" | "MXN";
  amount_cents: number;
  is_active: boolean;
};

type CouponRow = {
  code: string;
  discount_type: "percent" | "fixed";
  percent_off: number | null;
  amount_off_cents: number | null;
  currency: "USD" | "MXN" | null;
  lab_id: string | null;
  is_active: boolean;
  expires_at: string | null;
};

const VALID_CURRENCIES = new Set(["USD", "MXN"]);

export async function POST(request: Request) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return NextResponse.json(
      { error: "Falta STRIPE_SECRET_KEY en variables de entorno" },
      { status: 500 },
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Falta SUPABASE_SERVICE_ROLE_KEY para iniciar checkout" },
      { status: 500 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = (await request.json()) as CheckoutPayload;
  const labId = typeof body.labId === "string" ? body.labId : "";
  const requestedCurrency =
    typeof body.currency === "string" ? body.currency.toUpperCase() : "";
  const couponCode =
    typeof body.couponCode === "string" ? body.couponCode.trim().toUpperCase() : "";

  if (!labId) {
    return NextResponse.json({ error: "labId requerido" }, { status: 400 });
  }

  const [
    { data: lab, error: labError },
    { data: prices, error: pricesError },
    { data: entitlement, error: entitlementError },
  ] = await Promise.all([
    admin.from("labs").select("id, title").eq("id", labId).maybeSingle(),
    admin
      .from("lab_prices")
      .select("lab_id, currency, amount_cents, is_active")
      .eq("lab_id", labId)
      .eq("is_active", true),
    admin
      .from("lab_entitlements")
      .select("id")
      .eq("user_id", user.id)
      .eq("lab_id", labId)
      .eq("status", "active")
      .maybeSingle(),
  ]);

  if (labError) {
    return NextResponse.json({ error: labError.message }, { status: 500 });
  }
  if (!lab) {
    return NextResponse.json({ error: "Lab no encontrado" }, { status: 404 });
  }
  if (pricesError) {
    return NextResponse.json({ error: pricesError.message }, { status: 500 });
  }
  if (entitlementError) {
    return NextResponse.json({ error: entitlementError.message }, { status: 500 });
  }
  if (entitlement) {
    return NextResponse.json(
      { error: "Ya tienes acceso activo a este lab" },
      { status: 409 },
    );
  }

  const activePrices = (prices ?? []) as LabPriceRow[];
  if (activePrices.length === 0) {
    return NextResponse.json(
      { error: "No hay precio activo para este lab" },
      { status: 400 },
    );
  }

  const selectedPrice = selectPrice(activePrices, requestedCurrency);
  if (!selectedPrice) {
    return NextResponse.json(
      { error: "No hay precio activo en esa moneda" },
      { status: 400 },
    );
  }

  let discountCents = 0;
  let appliedCoupon: CouponRow | null = null;

  if (couponCode) {
    const { data: coupon, error: couponError } = await admin
      .from("coupons")
      .select(
        "code, discount_type, percent_off, amount_off_cents, currency, lab_id, is_active, expires_at",
      )
      .eq("code", couponCode)
      .maybeSingle();

    if (couponError) {
      return NextResponse.json({ error: couponError.message }, { status: 500 });
    }
    if (!coupon) {
      return NextResponse.json({ error: "Cupón no encontrado" }, { status: 400 });
    }

    const couponRow = coupon as CouponRow;
    const couponValidation = validateCouponForPurchase(
      couponRow,
      labId,
      selectedPrice.currency,
      selectedPrice.amount_cents,
    );

    if (couponValidation.error) {
      return NextResponse.json({ error: couponValidation.error }, { status: 400 });
    }

    discountCents = couponValidation.discountCents;
    appliedCoupon = couponRow;
  }

  const finalAmountCents = Math.max(selectedPrice.amount_cents - discountCents, 0);
  if (finalAmountCents <= 0) {
    return NextResponse.json(
      { error: "El cupón reduce el monto a cero. Ajusta el descuento." },
      { status: 400 },
    );
  }

  const appUrl = resolveAppUrl(request);
  const stripeSessionRes = await createStripeCheckoutSession({
    stripeSecretKey,
    labId,
    labTitle: lab.title as string,
    userId: user.id,
    userEmail: user.email ?? null,
    currency: selectedPrice.currency,
    finalAmountCents,
    originalAmountCents: selectedPrice.amount_cents,
    discountCents,
    couponCode: appliedCoupon?.code ?? null,
    successUrl: `${appUrl}/labs/${labId}?payment=success`,
    cancelUrl: `${appUrl}/?payment=cancelled&lab=${labId}`,
  });

  if (stripeSessionRes.error) {
    return NextResponse.json({ error: stripeSessionRes.error }, { status: 500 });
  }

  return NextResponse.json({
    url: stripeSessionRes.url,
    amountCents: finalAmountCents,
    discountCents,
    currency: selectedPrice.currency,
  });
}

function selectPrice(
  prices: LabPriceRow[],
  requestedCurrency: string,
): LabPriceRow | null {
  if (requestedCurrency && VALID_CURRENCIES.has(requestedCurrency)) {
    const exact = prices.find((price) => price.currency === requestedCurrency);
    if (exact) return exact;
  }

  const usd = prices.find((price) => price.currency === "USD");
  if (usd) return usd;
  const mxn = prices.find((price) => price.currency === "MXN");
  if (mxn) return mxn;
  return prices[0] ?? null;
}

function validateCouponForPurchase(
  coupon: CouponRow,
  labId: string,
  currency: "USD" | "MXN",
  amountCents: number,
): { discountCents: number; error?: string } {
  if (!coupon.is_active) return { discountCents: 0, error: "Cupón inactivo" };
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() <= Date.now()) {
    return { discountCents: 0, error: "Cupón expirado" };
  }
  if (coupon.lab_id && coupon.lab_id !== labId) {
    return { discountCents: 0, error: "Cupón no válido para este lab" };
  }

  if (coupon.discount_type === "percent") {
    const percent = coupon.percent_off ?? 0;
    if (percent <= 0 || percent > 100) {
      return { discountCents: 0, error: "Cupón de porcentaje inválido" };
    }
    return { discountCents: Math.round((amountCents * percent) / 100) };
  }

  if (!coupon.amount_off_cents || coupon.amount_off_cents <= 0) {
    return { discountCents: 0, error: "Cupón de monto fijo inválido" };
  }
  if (!coupon.currency || coupon.currency !== currency) {
    return {
      discountCents: 0,
      error: "Cupón fijo no aplica para la moneda seleccionada",
    };
  }

  return { discountCents: Math.min(coupon.amount_off_cents, amountCents) };
}

function resolveAppUrl(request: Request): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl) return envUrl.replace(/\/+$/, "");

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;

  const fallbackUrl = new URL(request.url);
  return `${fallbackUrl.protocol}//${fallbackUrl.host}`;
}

async function createStripeCheckoutSession(params: {
  stripeSecretKey: string;
  labId: string;
  labTitle: string;
  userId: string;
  userEmail: string | null;
  currency: "USD" | "MXN";
  finalAmountCents: number;
  originalAmountCents: number;
  discountCents: number;
  couponCode: string | null;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string; error?: undefined } | { url: null; error: string }> {
  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("success_url", params.successUrl);
  form.set("cancel_url", params.cancelUrl);
  form.set("client_reference_id", params.userId);
  form.set("line_items[0][quantity]", "1");
  form.set("line_items[0][price_data][currency]", params.currency.toLowerCase());
  form.set("line_items[0][price_data][unit_amount]", String(params.finalAmountCents));
  form.set("line_items[0][price_data][product_data][name]", `Lab: ${params.labTitle}`);

  if (params.userEmail) {
    form.set("customer_email", params.userEmail);
  }

  form.set("metadata[user_id]", params.userId);
  form.set("metadata[lab_id]", params.labId);
  form.set("metadata[coupon_code]", params.couponCode ?? "");
  form.set("metadata[currency]", params.currency);
  form.set("metadata[original_amount_cents]", String(params.originalAmountCents));
  form.set("metadata[discount_cents]", String(params.discountCents));
  form.set("metadata[final_amount_cents]", String(params.finalAmountCents));

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: form,
  });

  const payload = (await response.json()) as {
    url?: string;
    error?: { message?: string };
  };

  if (!response.ok || !payload.url) {
    return {
      url: null,
      error: payload.error?.message ?? "No se pudo crear sesión de Stripe",
    };
  }

  return { url: payload.url };
}
