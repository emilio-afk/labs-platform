export function resolveAppUrl(
  request: Pick<Request, "headers" | "url">,
  envUrl?: string | null,
): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const requestUrl = new URL(request.url);
  const proto =
    request.headers.get("x-forwarded-proto") ?? requestUrl.protocol.replace(/:$/, "");

  if (host) return `${proto}://${host}`;

  const normalizedEnvUrl = envUrl?.trim().replace(/\/+$/, "");
  if (normalizedEnvUrl) return normalizedEnvUrl;

  return `${requestUrl.protocol}//${requestUrl.host}`;
}
