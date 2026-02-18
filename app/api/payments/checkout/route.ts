import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";

type CheckoutPayload = {
  labId?: unknown;
  labIds?: unknown;
  currency?: unknown;
  couponCode?: unknown;
};

type LabRow = {
  id: string;
  title: string;
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

type LineItem = {
  labId: string;
  labTitle: string;
  amountCents: number;
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
  const requestedCurrency =
    typeof body.currency === "string" ? body.currency.toUpperCase() : "";
  const couponCode =
    typeof body.couponCode === "string" ? body.couponCode.trim().toUpperCase() : "";
  const requestedLabIds = normalizeLabIds(body.labIds, body.labId);

  if (requestedLabIds.length === 0) {
    return NextResponse.json({ error: "labId o labIds requerido" }, { status: 400 });
  }
  if (!VALID_CURRENCIES.has(requestedCurrency)) {
    return NextResponse.json({ error: "Moneda inválida" }, { status: 400 });
  }

  const [
    { data: labs, error: labsError },
    { data: prices, error: pricesError },
    { data: activeEntitlements, error: entitlementsError },
  ] = await Promise.all([
    admin.from("labs").select("id, title").in("id", requestedLabIds),
    admin
      .from("lab_prices")
      .select("lab_id, currency, amount_cents, is_active")
      .in("lab_id", requestedLabIds)
      .eq("is_active", true)
      .eq("currency", requestedCurrency),
    admin
      .from("lab_entitlements")
      .select("lab_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .in("lab_id", requestedLabIds),
  ]);

  if (labsError) {
    return NextResponse.json({ error: labsError.message }, { status: 500 });
  }
  if (pricesError) {
    return NextResponse.json({ error: pricesError.message }, { status: 500 });
  }
  if (entitlementsError) {
    return NextResponse.json({ error: entitlementsError.message }, { status: 500 });
  }

  const labRows = (labs ?? []) as LabRow[];
  if (labRows.length === 0) {
    return NextResponse.json({ error: "Labs no encontrados" }, { status: 404 });
  }

  const ownedLabIds = new Set(
    (activeEntitlements ?? [])
      .map((row) => row.lab_id)
      .filter((id): id is string => typeof id === "string"),
  );

  const pricesByLab = new Map<string, LabPriceRow>();
  for (const row of (prices ?? []) as LabPriceRow[]) {
    pricesByLab.set(row.lab_id, row);
  }

  const labsById = new Map(labRows.map((row) => [row.id, row]));
  const payableLines: LineItem[] = [];

  for (const labId of requestedLabIds) {
    if (ownedLabIds.has(labId)) continue;
    const lab = labsById.get(labId);
    const price = pricesByLab.get(labId);
    if (!lab || !price) {
      return NextResponse.json(
        { error: `El lab seleccionado no tiene precio en ${requestedCurrency}` },
        { status: 400 },
      );
    }
    payableLines.push({
      labId,
      labTitle: lab.title,
      amountCents: price.amount_cents,
    });
  }

  if (payableLines.length === 0) {
    return NextResponse.json(
      { error: "Ya tienes acceso activo a todos los labs seleccionados" },
      { status: 409 },
    );
  }

  const originalAmountCents = payableLines.reduce((sum, line) => sum + line.amountCents, 0);

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

    const couponResult = validateCouponForLines(
      coupon as CouponRow,
      requestedCurrency as "USD" | "MXN",
      payableLines,
    );

    if (couponResult.error) {
      return NextResponse.json({ error: couponResult.error }, { status: 400 });
    }

    discountCents = couponResult.discountCents;
    appliedCoupon = coupon as CouponRow;
  }

  const finalAmountCents = Math.max(originalAmountCents - discountCents, 0);
  const appUrl = resolveAppUrl(request);
  const labIds = payableLines.map((line) => line.labId);
  const successUrl = resolveSuccessUrl(appUrl, labIds);
  const cancelUrl = resolveCancelUrl(appUrl, labIds);

  if (finalAmountCents <= 0) {
    const freeGrantResult = await grantFreeAccess({
      admin,
      userId: user.id,
      labIds,
      currency: requestedCurrency as "USD" | "MXN",
      originalAmountCents,
      discountCents,
      couponCode: (appliedCoupon?.code ?? couponCode) || null,
    });

    if (freeGrantResult.error) {
      return NextResponse.json({ error: freeGrantResult.error }, { status: 500 });
    }

    return NextResponse.json({
      url: `${successUrl}${successUrl.includes("?") ? "&" : "?"}source=coupon`,
      amountCents: 0,
      discountCents,
      currency: requestedCurrency,
      freeAccess: true,
    });
  }

  const stripeSessionRes = await createStripeCheckoutSession({
    stripeSecretKey,
    labTitles: payableLines.map((line) => line.labTitle),
    labIds,
    userId: user.id,
    userEmail: user.email ?? null,
    currency: requestedCurrency as "USD" | "MXN",
    finalAmountCents,
    originalAmountCents,
    discountCents,
    couponCode: appliedCoupon?.code ?? null,
    successUrl,
    cancelUrl,
  });

  if (stripeSessionRes.error) {
    return NextResponse.json({ error: stripeSessionRes.error }, { status: 500 });
  }

  return NextResponse.json({
    url: stripeSessionRes.url,
    amountCents: finalAmountCents,
    discountCents,
    currency: requestedCurrency,
  });
}

async function grantFreeAccess(params: {
  admin: NonNullable<ReturnType<typeof createAdminClient>>;
  userId: string;
  labIds: string[];
  currency: "USD" | "MXN";
  originalAmountCents: number;
  discountCents: number;
  couponCode: string | null;
}): Promise<{ error?: string }> {
  const primaryLabId = params.labIds[0];
  if (!primaryLabId) {
    return { error: "No hay labs para otorgar acceso" };
  }

  const nowIso = new Date().toISOString();
  const syntheticSessionId = `coupon_free_${params.userId}_${Date.now()}`;

  const [orderRes, entitlementRes] = await Promise.all([
    params.admin.from("payment_orders").insert([
      {
        stripe_session_id: syntheticSessionId,
        stripe_payment_intent_id: null,
        user_id: params.userId,
        lab_id: primaryLabId,
        amount_cents: 0,
        currency: params.currency,
        coupon_code: params.couponCode,
        status: "paid",
        source: "coupon",
        metadata: {
          lab_ids: params.labIds.join(","),
          lab_count: params.labIds.length,
          original_amount_cents: params.originalAmountCents,
          discount_cents: params.discountCents,
          grant_type: "free_coupon",
        },
        updated_at: nowIso,
      },
    ]),
    params.admin.from("lab_entitlements").upsert(
      params.labIds.map((labId) => ({
        user_id: params.userId,
        lab_id: labId,
        status: "active",
        source: "coupon",
        updated_at: nowIso,
      })),
      { onConflict: "user_id,lab_id" },
    ),
  ]);

  if (orderRes.error) {
    return { error: orderRes.error.message };
  }
  if (entitlementRes.error) {
    return { error: entitlementRes.error.message };
  }

  return {};
}

function normalizeLabIds(labIds: unknown, labId: unknown): string[] {
  const fromArray = Array.isArray(labIds)
    ? labIds.filter((item): item is string => typeof item === "string")
    : [];
  const fromSingle = typeof labId === "string" && labId ? [labId] : [];
  return Array.from(
    new Set(
      [...fromArray, ...fromSingle]
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  );
}

function validateCouponForLines(
  coupon: CouponRow,
  currency: "USD" | "MXN",
  lines: LineItem[],
): { discountCents: number; error?: string } {
  if (!coupon.is_active) return { discountCents: 0, error: "Cupón inactivo" };
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() <= Date.now()) {
    return { discountCents: 0, error: "Cupón expirado" };
  }

  const targetLines = coupon.lab_id
    ? lines.filter((line) => line.labId === coupon.lab_id)
    : lines;

  if (targetLines.length === 0) {
    return { discountCents: 0, error: "Cupón no válido para este carrito" };
  }

  const targetSubtotal = targetLines.reduce((sum, line) => sum + line.amountCents, 0);

  if (coupon.discount_type === "percent") {
    const percent = coupon.percent_off ?? 0;
    if (percent <= 0 || percent > 100) {
      return { discountCents: 0, error: "Cupón de porcentaje inválido" };
    }
    return { discountCents: Math.round((targetSubtotal * percent) / 100) };
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

  return { discountCents: Math.min(coupon.amount_off_cents, targetSubtotal) };
}

function resolveSuccessUrl(appUrl: string, labIds: string[]): string {
  return `${appUrl}/cart?payment=success&labs=${encodeURIComponent(labIds.join(","))}`;
}

function resolveCancelUrl(appUrl: string, labIds: string[]): string {
  return `${appUrl}/cart?payment=cancelled&labs=${encodeURIComponent(labIds.join(","))}`;
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
  labTitles: string[];
  labIds: string[];
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
  form.set(
    "line_items[0][price_data][product_data][name]",
    params.labIds.length === 1
      ? `Lab: ${params.labTitles[0] ?? "Astrolab"}`
      : `Carrito Astrolab (${params.labIds.length} labs)`,
  );

  if (params.labIds.length > 1) {
    form.set(
      "line_items[0][price_data][product_data][description]",
      params.labTitles.slice(0, 3).join(", "),
    );
  }

  if (params.userEmail) {
    form.set("customer_email", params.userEmail);
  }

  form.set("metadata[user_id]", params.userId);
  form.set("metadata[lab_id]", params.labIds[0] ?? "");
  form.set("metadata[lab_ids]", params.labIds.join(","));
  form.set("metadata[lab_count]", String(params.labIds.length));
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
