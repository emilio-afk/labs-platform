import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import CartCheckoutPanel from "@/components/CartCheckoutPanel";
import PaymentStatusNotice from "@/components/PaymentStatusNotice";

type LabCard = {
  id: string;
  title: string;
};

type LabPrice = {
  lab_id: string;
  currency: "USD" | "MXN";
  amount_cents: number;
  is_active: boolean;
};

export default async function CartPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string; lab?: string; labs?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const dataClient = adminSupabase ?? supabase;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role === "admin") {
    redirect("/admin");
  }

  const [{ data: catalogLabs }, { data: activePriceRows }, { data: entitlements }] =
    await Promise.all([
      dataClient
        .from("labs")
        .select("id, title")
        .order("created_at", { ascending: false }),
      dataClient
        .from("lab_prices")
        .select("lab_id, currency, amount_cents, is_active")
        .eq("is_active", true),
      supabase
        .from("lab_entitlements")
        .select("lab_id")
        .eq("user_id", user.id)
        .eq("status", "active"),
    ]);

  const labs = (catalogLabs ?? []) as LabCard[];
  const ownedLabIds = new Set(
    (entitlements ?? [])
      .map((row) => row.lab_id)
      .filter((id): id is string => typeof id === "string"),
  );

  const pricesByLab = new Map<
    string,
    Array<{ currency: "USD" | "MXN"; amountCents: number }>
  >();
  for (const row of (activePriceRows ?? []) as LabPrice[]) {
    const list = pricesByLab.get(row.lab_id) ?? [];
    list.push({ currency: row.currency, amountCents: row.amount_cents });
    pricesByLab.set(row.lab_id, list);
  }

  const blockedLabs = labs
    .filter((lab) => !ownedLabIds.has(lab.id))
    .map((lab) => ({
      id: lab.id,
      title: lab.title,
      prices: pricesByLab.get(lab.id) ?? [],
    }));

  const paymentSuccess = query.payment === "success";
  const paymentCancelled = query.payment === "cancelled";
  const paymentLabIds = parsePaymentLabIds(query.lab, query.labs);
  const paymentLabTitles = paymentLabIds
    .map((id) => labs.find((lab) => lab.id === id)?.title)
    .filter((title): title is string => Boolean(title));

  return (
    <div className="min-h-screen bg-[var(--ui-bg)] text-[var(--ui-text)]">
      <div className="border-b border-[var(--ui-border)] bg-[rgba(5,14,34,0.92)] px-6 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <Link href="/">
            <Image
              src="/logo-astrolab-light.png"
              alt="Astrolab"
              width={140}
              height={26}
              className="h-5 w-auto opacity-90"
            />
          </Link>
          <div className="hidden items-center gap-2 sm:flex">
            <span className="rounded-full border border-[var(--ui-primary)]/50 bg-[rgba(10,86,198,0.18)] px-3 py-1 text-[11px] font-semibold text-[var(--ast-sky)]">
              Carrito
            </span>
            <span className="text-[var(--ui-border)]">→</span>
            <span className="text-[11px] text-[var(--ui-muted)]">Pago</span>
            <span className="text-[var(--ui-border)]">→</span>
            <span className="text-[11px] text-[var(--ui-muted)]">Acceso</span>
          </div>
          <Link
            href="/"
            className="rounded-full border border-[var(--ui-border)] bg-transparent px-3 py-1.5 text-xs font-medium text-[var(--ui-muted)] transition hover:border-[var(--ui-border)]/80 hover:text-[var(--ui-text)]"
          >
            ← Labs
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-3xl space-y-5 px-6 py-8">
        {paymentCancelled && (
          <PaymentStatusNotice
            message={`Pago cancelado. Tu acceso sigue bloqueado${
              paymentLabTitles.length === 1
                ? ` para "${paymentLabTitles[0]}"`
                : paymentLabTitles.length > 1
                  ? ` para ${paymentLabTitles.length} labs`
                  : ""
            }.`}
          />
        )}
        {paymentSuccess && (
          <PaymentStatusNotice
            tone="success"
            clearCartLabIds={paymentLabIds}
            message={`Pago confirmado. ${
              paymentLabTitles.length > 0
                ? `Estamos activando acceso para: ${paymentLabTitles.join(", ")}.`
                : "Estamos activando tu acceso."
            }`}
          />
        )}

        {blockedLabs.length === 0 ? (
          <div className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-8 text-center">
            <h2 className="text-xl font-bold text-[var(--ui-text)]">
              Ya tienes todos los labs desbloqueados
            </h2>
            <p className="mt-2 text-sm text-[var(--ui-muted)]">
              No hay labs pendientes de compra.
            </p>
          </div>
        ) : (
          <CartCheckoutPanel labs={blockedLabs} />
        )}
      </main>
    </div>
  );
}

function parsePaymentLabIds(lab: string | undefined, labs: string | undefined): string[] {
  const ids = [
    ...(typeof lab === "string" && lab ? [lab] : []),
    ...((typeof labs === "string" && labs
      ? labs
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : []) as string[]),
  ];
  return Array.from(new Set(ids));
}
