import { NextResponse } from "next/server";
import { requireAdmin } from "../_helpers";

type PricingPayload = {
  labId?: unknown;
  currency?: unknown;
  amount?: unknown;
  isActive?: unknown;
};

const VALID_CURRENCIES = new Set(["USD", "MXN"]);

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { admin } = auth;

  const { searchParams } = new URL(request.url);
  const labId = searchParams.get("labId");
  if (!labId) {
    return NextResponse.json({ error: "labId requerido" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("lab_prices")
    .select("id, lab_id, currency, amount_cents, is_active, updated_at")
    .eq("lab_id", labId)
    .order("currency", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: normalizeSchemaError(error.message, "lab_prices") },
      { status: 500 },
    );
  }

  return NextResponse.json({ prices: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { admin } = auth;

  const body = (await request.json()) as PricingPayload;
  const labId = typeof body.labId === "string" ? body.labId : "";
  const currency =
    typeof body.currency === "string" ? body.currency.toUpperCase() : "";
  const amountNumber =
    typeof body.amount === "number" ? body.amount : Number(body.amount);
  const isActive = typeof body.isActive === "boolean" ? body.isActive : true;

  if (!labId || !VALID_CURRENCIES.has(currency) || !Number.isFinite(amountNumber)) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }
  if (amountNumber <= 0) {
    return NextResponse.json({ error: "El monto debe ser mayor a 0" }, { status: 400 });
  }

  const amountCents = Math.round(amountNumber * 100);
  const { error } = await admin.from("lab_prices").upsert(
    [
      {
        lab_id: labId,
        currency,
        amount_cents: amountCents,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      },
    ],
    { onConflict: "lab_id,currency" },
  );

  if (error) {
    return NextResponse.json(
      { error: normalizeSchemaError(error.message, "lab_prices") },
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
