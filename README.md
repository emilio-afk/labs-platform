# Labs Platform

Plataforma de aprendizaje construida con `Next.js`, `Supabase` y `Stripe` para publicar labs, vender acceso por lab y administrar contenido, usuarios y pricing desde un panel interno.

## Qué hace

- Catálogo público de labs con hero configurable.
- Autenticación con Supabase: login, signup y recuperación de contraseña.
- Acceso por usuario mediante `lab_entitlements`.
- Carrito y checkout con Stripe.
- Soporte comercial para precios en `USD` y `MXN`.
- Cupones por porcentaje o monto fijo.
- Panel admin para:
  - editar hero del sitio,
  - crear/editar/duplicar labs,
  - gestionar días y contenido,
  - moderar comentarios,
  - administrar usuarios y accesos,
  - configurar precios y cupones.

## Stack

- `Next.js 16`
- `React 19`
- `TypeScript`
- `Tailwind CSS v4`
- `Supabase SSR`
- `Stripe Checkout`
- Deploy en `Netlify`

## Estructura principal

```text
app/
  page.tsx                    Home pública y catálogo
  login/page.tsx              Auth
  cart/page.tsx               Carrito y estado de pago
  admin/page.tsx              Panel administrativo
  api/
    payments/                 Cotización y checkout
    stripe/webhook/           Confirmación de pagos
    progress/                 Progreso de usuario
    day-state/                Estado de avance por día
    admin/                    Endpoints internos del panel
components/
  AdminPanel.tsx              UI principal del panel admin
  CartCheckoutPanel.tsx       Flujo de compra
  LabsMarketplace.tsx         Catálogo de labs
  LabContent.tsx              Consumo de contenido del lab
utils/
  supabase/                   Clientes SSR, browser y admin
  appUrl.ts                   Resolución de URL base para checkout
docs/
  supabase-*.sql              Bootstrap de tablas y soporte comercial
  stripe-integration.md       Guía de Stripe
  supabase-email-templates.md Plantillas y redirects de auth
```

## Requisitos

- `Node.js 20+`
- Cuenta de `Supabase`
- Cuenta de `Stripe`
- Sitio configurado en `Netlify`

## Variables de entorno

Crea un archivo `.env.local` con al menos:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_BYPASS_SUPABASE_PROXY=1
```

Notas:

- `SUPABASE_SERVICE_ROLE_KEY` se usa en rutas server/admin y en webhooks.
- `NEXT_PUBLIC_APP_URL` se usa como fallback para redirects de checkout.
- En producción, configura estas variables también en Netlify.

## Instalación

```bash
npm install
```

## Desarrollo local

```bash
npm run dev
```

Servidor local por defecto:

- `http://localhost:3000`

## Scripts

```bash
npm run dev
npm run dev:turbo
npm run build
npm run start
npm run lint
```

## Bootstrap de base de datos

Ejecuta en Supabase SQL Editor los scripts que necesites según el estado de tu proyecto:

1. `docs/supabase-commercial-setup.sql`
   Crea `lab_prices` y `coupons`.
2. `docs/supabase-stripe-setup.sql`
   Crea `payment_orders`.
3. `docs/supabase-learning-state.sql`
   Estado de aprendizaje/progreso.
4. `docs/supabase-lab-meta.sql`
   Metadatos de labs.
5. `docs/supabase-lab-labels.sql`
   Labels de catálogo.

## Flujo de pagos

1. El usuario agrega labs al carrito.
2. `POST /api/payments/quote` calcula subtotales, descuentos y validaciones.
3. `POST /api/payments/checkout` crea la sesión de Stripe Checkout.
4. Stripe llama `POST /api/stripe/webhook`.
5. El webhook registra la orden y activa `lab_entitlements`.

Referencia adicional:

- [docs/stripe-integration.md](./docs/stripe-integration.md)

## Auth y redirects

El proyecto usa Supabase Auth con redirects desde el origen actual del navegador para:

- confirmación de signup,
- recuperación de contraseña,
- retorno al sitio después de acciones de auth.

Además, en Supabase debes permitir tus dominios en las redirect URLs. Revisa:

- [docs/supabase-email-templates.md](./docs/supabase-email-templates.md)

## Deploy

El proyecto está pensado para ejecutarse en `Netlify`.

Checklist mínimo de producción:

1. Configurar variables de entorno en Netlify.
2. Apuntar `NEXT_PUBLIC_APP_URL` al dominio público correcto.
3. Configurar el webhook de Stripe en:
   `https://TU_DOMINIO/api/stripe/webhook`
4. Agregar el dominio público en los redirects permitidos de Supabase.

## Modelo conceptual

- `labs`: catálogo principal.
- `days`: unidades de contenido dentro de cada lab.
- `profiles`: rol y datos del usuario.
- `lab_entitlements`: acceso activo por usuario/lab.
- `lab_prices`: pricing por moneda.
- `coupons`: descuentos.
- `payment_orders`: órdenes derivadas de Stripe.
- `progress`: avance del usuario.
- `comments`: interacción dentro del contenido.
- `app_settings`: contenido editable del hero.

## Pendientes útiles al trabajar en este repo

- Verificar que `NEXT_PUBLIC_APP_URL` y el dominio real estén alineados en producción.
- Mantener en sync los redirects de Supabase al cambiar de dominio.
- Confirmar webhook de Stripe después de cualquier cambio de dominio.

