import { NextResponse } from "next/server";
import { requireAdmin } from "../_helpers";

type CouponPayload = {
  id?: unknown;
  code?: unknown;
  discountType?: unknown;
  percentOff?: unknown;
  amountOff?: unknown;
  currency?: unknown;
  labId?: unknown;
  expiresAt?: unknown;
  isActive?: unknown;
};

const VALID_CURRENCIES = new Set(["USD", "MXN"]);

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { admin } = auth;

  const { searchParams } = new URL(request.url);
  const labId = searchParams.get("labId");
  const scope = searchParams.get("scope");

  let query = admin
    .from("coupons")
    .select(
      "id, code, discount_type, percent_off, amount_off_cents, currency, lab_id, is_active, expires_at, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (scope === "lab" && labId) {
    query = query.eq("lab_id", labId);
  } else if (scope === "global") {
    query = query.is("lab_id", null);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { error: normalizeSchemaError(error.message, "coupons") },
      { status: 500 },
    );
  }

  return NextResponse.json({ coupons: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { admin } = auth;

  const body = (await request.json()) as CouponPayload;
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const discountType = typeof body.discountType === "string" ? body.discountType : "";
  const percentOff = Number(body.percentOff);
  const amountOff = Number(body.amountOff);
  const currency =
    typeof body.currency === "string" ? body.currency.toUpperCase() : null;
  const labId = typeof body.labId === "string" && body.labId ? body.labId : null;
  const expiresAt =
    typeof body.expiresAt === "string" && body.expiresAt ? body.expiresAt : null;
  const isActive = typeof body.isActive === "boolean" ? body.isActive : true;

  if (!code) {
    return NextResponse.json({ error: "Código requerido" }, { status: 400 });
  }
  if (discountType !== "percent" && discountType !== "fixed") {
    return NextResponse.json({ error: "Tipo de descuento inválido" }, { status: 400 });
  }

  let payload: Record<string, unknown> = {
    code,
    discount_type: discountType,
    lab_id: labId,
    is_active: isActive,
    expires_at: expiresAt,
  };

  if (discountType === "percent") {
    if (!Number.isFinite(percentOff) || percentOff <= 0 || percentOff > 100) {
      return NextResponse.json(
        { error: "Porcentaje inválido (1-100)" },
        { status: 400 },
      );
    }
    payload = {
      ...payload,
      percent_off: Math.round(percentOff),
      amount_off_cents: null,
      currency: null,
    };
  } else {
    if (!Number.isFinite(amountOff) || amountOff <= 0) {
      return NextResponse.json(
        { error: "Monto fijo inválido (> 0)" },
        { status: 400 },
      );
    }
    if (!currency || !VALID_CURRENCIES.has(currency)) {
      return NextResponse.json(
        { error: "Moneda inválida para cupón fijo" },
        { status: 400 },
      );
    }
    payload = {
      ...payload,
      percent_off: null,
      amount_off_cents: Math.round(amountOff * 100),
      currency,
    };
  }

  const { error } = await admin.from("coupons").insert([payload]);
  if (error) {
    return NextResponse.json(
      { error: normalizeSchemaError(error.message, "coupons") },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { admin } = auth;

  const body = (await request.json()) as CouponPayload;
  const id = typeof body.id === "string" ? body.id : "";
  const isActive = typeof body.isActive === "boolean" ? body.isActive : null;
  if (!id || isActive === null) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const { error } = await admin
    .from("coupons")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: normalizeSchemaError(error.message, "coupons") },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

function normalizeSchemaError(errorMessage: string, relation: string) {
  if (errorMessage.includes(`relation "${relation}" does not exist`)) {
    return `Falta la tabla ${relation}. Ejecuta el SQL de setup comercial primero.`;
  }
  return errorMessage;
}
