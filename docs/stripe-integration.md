# Stripe Integration (Labs Platform)

## 1) Variables de entorno (Netlify)

Agrega estas variables:

- `STRIPE_SECRET_KEY` (tu llave secreta de Stripe, modo test o live)
- `STRIPE_WEBHOOK_SECRET` (firmado del webhook endpoint)
- `NEXT_PUBLIC_APP_URL` (ej. `https://labs-platform.netlify.app`)
- `SUPABASE_SERVICE_ROLE_KEY` (ya necesaria para admin/webhooks)

## 2) SQL en Supabase

Ejecuta:

- `docs/supabase-commercial-setup.sql` (si no lo corriste antes)
- `docs/supabase-stripe-setup.sql`

## 3) Endpoint de webhook en Stripe

En Stripe Dashboard:

1. Ve a `Developers` -> `Webhooks`.
2. Crea endpoint: `https://TU_DOMINIO/api/stripe/webhook`.
3. Eventos a escuchar:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `checkout.session.expired`
4. Copia el `Signing secret` y pégalo en `STRIPE_WEBHOOK_SECRET`.

## 4) Flujo implementado

- Frontend llama: `POST /api/payments/checkout`.
- Backend valida:
  - usuario autenticado,
  - precio activo (`lab_prices`),
  - cupón válido (`coupons`),
  - acceso previo (`lab_entitlements`).
- Crea Stripe Checkout Session y redirige al pago.
- Webhook confirma pago y:
  - guarda orden en `payment_orders`,
  - otorga acceso en `lab_entitlements` con `status='active'`.

## 5) Prueba rápida (modo test)

1. En admin configura precio del lab (`USD` o `MXN`).
2. Loguea un usuario sin acceso.
3. Haz clic en `Pagar ahora`.
4. Paga con tarjeta de prueba Stripe.
5. Verifica:
   - fila en `payment_orders`,
   - acceso activo en `lab_entitlements`,
   - usuario puede abrir todos los días del lab.
