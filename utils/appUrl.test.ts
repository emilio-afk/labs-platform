import test from "node:test";
import assert from "node:assert/strict";

import { resolveAppUrl } from "./appUrl.ts";

function createRequest(url: string, headers: Record<string, string> = {}): Request {
  return new Request(url, { headers: new Headers(headers) });
}

test("resolveAppUrl usa el host real de la peticion aunque exista NEXT_PUBLIC_APP_URL", () => {
  const request = createRequest("https://labs-platform.netlify.app/api/payments/checkout", {
    "x-forwarded-host": "astrolab.example.com",
    "x-forwarded-proto": "https",
  });

  const result = resolveAppUrl(
    request,
    "https://labs-platform.netlify.app",
  );

  assert.equal(result, "https://astrolab.example.com");
});

test("resolveAppUrl usa NEXT_PUBLIC_APP_URL cuando no hay host reenviado", () => {
  const request = createRequest("http://127.0.0.1:8888/api/payments/checkout");

  const result = resolveAppUrl(request, "https://astrolab.example.com/");

  assert.equal(result, "https://astrolab.example.com");
});
