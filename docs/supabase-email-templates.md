# Supabase Email Templates (Astrolab)

Use these templates in Supabase:
- `Authentication` -> `Email Templates`
- Update subject + body for:
1. `Confirm signup`
2. `Reset password`

## Confirm Signup

Subject:
`Confirma tu correo en ASTROLAB`

HTML body:

```html
<div style="font-family: Arial, Helvetica, sans-serif; background:#011963; padding:24px; color:#F0F2DA;">
  <div style="max-width:560px; margin:0 auto; background:#0A56C6; border:1px solid #B9D6FE55; border-radius:16px; padding:28px;">
    <h1 style="margin:0 0 12px; color:#B9D6FE;">Bienvenido a ASTROLAB</h1>
    <p style="margin:0 0 16px; line-height:1.5;">
      Gracias por registrarte. Para activar tu cuenta y comenzar, confirma tu correo.
    </p>
    <a href="{{ .ConfirmationURL }}" style="display:inline-block; text-decoration:none; background:#04A45A; color:#262626; font-weight:700; padding:12px 18px; border-radius:999px;">
      Confirmar correo
    </a>
    <p style="margin:18px 0 0; font-size:13px; color:#F0F2DACC;">
      Si no creaste esta cuenta, puedes ignorar este correo.
    </p>
  </div>
</div>
```

## Reset Password

Subject:
`Restablece tu contraseña de ASTROLAB`

HTML body:

```html
<div style="font-family: Arial, Helvetica, sans-serif; background:#011963; padding:24px; color:#F0F2DA;">
  <div style="max-width:560px; margin:0 auto; background:#0A56C6; border:1px solid #B9D6FE55; border-radius:16px; padding:28px;">
    <h1 style="margin:0 0 12px; color:#B9D6FE;">Recuperar acceso</h1>
    <p style="margin:0 0 16px; line-height:1.5;">
      Recibimos una solicitud para cambiar tu contraseña.
      Haz clic en el botón para continuar.
    </p>
    <a href="{{ .ConfirmationURL }}" style="display:inline-block; text-decoration:none; background:#04A45A; color:#262626; font-weight:700; padding:12px 18px; border-radius:999px;">
      Cambiar contraseña
    </a>
    <p style="margin:18px 0 0; font-size:13px; color:#F0F2DACC;">
      Si no solicitaste este cambio, ignora este correo.
    </p>
  </div>
</div>
```

## Notes

- Keep redirect URLs configured:
  - `https://labs-platform.netlify.app/**`
  - `http://localhost:3000/**`
- The reset flow in app already redirects users to:
  - `/reset-password`
