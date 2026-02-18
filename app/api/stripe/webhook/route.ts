import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";

const SIGNATURE_TOLERANCE_SECONDS = 300;

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Falta STRIPE_WEBHOOK_SECRET" },
      { status: 500 },
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Falta SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 },
    );
  }

  const rawBody = await request.text();
  const signatureHeader = request.headers.get("stripe-signature") ?? "";
  const verification = verifyStripeSignature(rawBody, signatureHeader, webhookSecret);
  if (!verification.valid) {
    return NextResponse.json({ error: verification.error }, { status: 400 });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Payload JSON inválido" }, { status: 400 });
  }

  const eventType = typeof event.type === "string" ? event.type : "";
  const data = event.data as Record<string, unknown> | undefined;
  const object = data?.object as Record<string, unknown> | undefined;

  if (!object) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  if (
    eventType !== "checkout.session.completed" &&
    eventType !== "checkout.session.async_payment_succeeded" &&
    eventType !== "checkout.session.async_payment_failed" &&
    eventType !== "checkout.session.expired"
  ) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const sessionId = getString(object.id);
  if (!sessionId) {
    return NextResponse.json({ error: "Session id faltante" }, { status: 400 });
  }

  const metadata = (object.metadata ?? {}) as Record<string, unknown>;
  const userId = getString(metadata.user_id) || getString(object.client_reference_id);
  const metadataLabIds = parseLabIds(getString(metadata.lab_ids));
  const fallbackLabId = getString(metadata.lab_id);
  const labIds = metadataLabIds.length > 0 ? metadataLabIds : fallbackLabId ? [fallbackLabId] : [];
  const couponCode = getString(metadata.coupon_code) || null;

  if (!userId || labIds.length === 0) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const amountTotal = normalizeAmount(object.amount_total);
  const currency = normalizeCurrency(getString(object.currency));
  const paymentStatus = getString(object.payment_status);
  const orderStatus = mapOrderStatus(eventType, paymentStatus);

  const primaryLabId = labIds[0];

  const orderPayload = {
    stripe_session_id: sessionId,
    stripe_payment_intent_id: getString(object.payment_intent) || null,
    user_id: userId,
    lab_id: primaryLabId,
    amount_cents: amountTotal,
    currency,
    coupon_code: couponCode,
    status: orderStatus,
    source: "stripe",
    metadata: {
      ...metadata,
      lab_ids: labIds.join(","),
      lab_count: labIds.length,
    },
    updated_at: new Date().toISOString(),
  };

  const { error: orderError } = await admin.from("payment_orders").upsert(
    [orderPayload],
    { onConflict: "stripe_session_id" },
  );

  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 500 });
  }

  if (orderStatus === "paid") {
    const { error: entitlementError } = await admin.from("lab_entitlements").upsert(
      labIds.map((labId) => ({
        user_id: userId,
        lab_id: labId,
        status: "active",
        source: "stripe",
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "user_id,lab_id" },
    );

    if (entitlementError) {
      return NextResponse.json({ error: entitlementError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

function getString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeAmount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.round(value);
}

function normalizeCurrency(value: string): "USD" | "MXN" {
  return value.toUpperCase() === "USD" ? "USD" : "MXN";
}

function mapOrderStatus(
  eventType: string,
  paymentStatus: string,
): "created" | "paid" | "failed" | "expired" {
  if (eventType === "checkout.session.expired") return "expired";
  if (eventType === "checkout.session.async_payment_failed") return "failed";
  if (
    eventType === "checkout.session.async_payment_succeeded" ||
    paymentStatus === "paid"
  ) {
    return "paid";
  }
  return "created";
}

function verifyStripeSignature(
  payload: string,
  signatureHeader: string,
  webhookSecret: string,
): { valid: true } | { valid: false; error: string } {
  if (!signatureHeader) {
    return { valid: false, error: "Firma faltante" };
  }

  const parsed = parseStripeSignatureHeader(signatureHeader);
  if (!parsed.timestamp || parsed.v1.length === 0) {
    return { valid: false, error: "Firma inválida" };
  }

  const age = Math.abs(Math.floor(Date.now() / 1000) - parsed.timestamp);
  if (age > SIGNATURE_TOLERANCE_SECONDS) {
    return { valid: false, error: "Firma expirada" };
  }

  const expected = createHmac("sha256", webhookSecret)
    .update(`${parsed.timestamp}.${payload}`)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "hex");
  const matches = parsed.v1.some((candidate) => {
    const candidateBuffer = Buffer.from(candidate, "hex");
    if (candidateBuffer.length !== expectedBuffer.length) return false;
    return timingSafeEqual(candidateBuffer, expectedBuffer);
  });

  if (!matches) {
    return { valid: false, error: "Firma no coincide" };
  }

  return { valid: true };
}

function parseStripeSignatureHeader(signatureHeader: string): {
  timestamp: number | null;
  v1: string[];
} {
  const parts = signatureHeader.split(",").map((part) => part.trim());
  let timestamp: number | null = null;
  const v1: string[] = [];

  for (const part of parts) {
    const [key, value] = part.split("=", 2);
    if (!key || !value) continue;
    if (key === "t") {
      const parsed = Number.parseInt(value, 10);
      timestamp = Number.isFinite(parsed) ? parsed : null;
    } else if (key === "v1") {
      v1.push(value);
    }
  }

  return { timestamp, v1 };
}

function parseLabIds(raw: string): string[] {
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}
