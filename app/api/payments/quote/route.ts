import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

type QuotePayload = {
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
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Falta SUPABASE_SERVICE_ROLE_KEY para cotizar pago" },
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

  const body = (await request.json()) as QuotePayload;
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

  const [{ data: labs, error: labsError }, { data: prices, error: pricesError }] =
    await Promise.all([
      admin.from("labs").select("id, title").in("id", requestedLabIds),
      admin
        .from("lab_prices")
        .select("lab_id, currency, amount_cents, is_active")
        .in("lab_id", requestedLabIds)
        .eq("is_active", true)
        .eq("currency", requestedCurrency),
    ]);

  if (labsError) {
    return NextResponse.json({ error: labsError.message }, { status: 500 });
  }
  if (pricesError) {
    return NextResponse.json({ error: pricesError.message }, { status: 500 });
  }

  const labRows = (labs ?? []) as LabRow[];
  if (labRows.length === 0) {
    return NextResponse.json({ error: "Labs no encontrados" }, { status: 404 });
  }

  const { data: activeEntitlements, error: entitlementsError } = await admin
    .from("lab_entitlements")
    .select("lab_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .in("lab_id", requestedLabIds);

  if (entitlementsError) {
    return NextResponse.json({ error: entitlementsError.message }, { status: 500 });
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
  let couponApplied = false;
  let message = "Monto base";

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
    couponApplied = true;
    message =
      originalAmountCents - discountCents <= 0
        ? `Cupón "${couponCode}" aplicado: acceso gratuito`
        : `Cupón "${couponCode}" aplicado`;
  }

  const finalAmountCents = Math.max(originalAmountCents - discountCents, 0);

  return NextResponse.json({
    ok: true,
    currency: requestedCurrency,
    lineItems: payableLines,
    originalAmountCents,
    discountCents,
    finalAmountCents,
    couponApplied,
    freeAccess: finalAmountCents === 0,
    message,
  });
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
