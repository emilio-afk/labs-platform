import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const AUTH_REFRESH_TIMEOUT_MS = 3500;
const BYPASS_SUPABASE_PROXY = process.env.NEXT_PUBLIC_BYPASS_SUPABASE_PROXY === "1";

export async function proxy(request: NextRequest) {
  if (BYPASS_SUPABASE_PROXY) {
    return NextResponse.next({ request });
  }

  const hasSupabaseSessionCookie = request.cookies
    .getAll()
    .some(
      ({ name }) =>
        name.startsWith("sb-") && name.includes("-auth-token"),
    );

  // Skip auth refresh for anonymous visitors to avoid unnecessary latency/noise.
  if (!hasSupabaseSessionCookie) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Esto refresca la sesión si es necesario
  try {
    await withTimeout(supabase.auth.getUser(), AUTH_REFRESH_TIMEOUT_MS);
  } catch (error) {
    const message =
      error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    const isMissingRefreshToken = message.includes("refresh token not found");
    if (isMissingRefreshToken) {
      clearSupabaseAuthCookies(request, supabaseResponse);
    }
    if (process.env.NODE_ENV !== "production" && !isMissingRefreshToken) {
      console.warn("[proxy] Supabase auth refresh timeout/failure:", error);
    }
  }

  return supabaseResponse;
}

function clearSupabaseAuthCookies(request: NextRequest, response: NextResponse) {
  const authCookieNames = request.cookies
    .getAll()
    .map(({ name }) => name)
    .filter((name) => name.startsWith("sb-") && name.includes("-auth-token"));

  authCookieNames.forEach((name) => {
    request.cookies.delete(name);
    response.cookies.set(name, "", { maxAge: 0, path: "/" });
  });
}

export const config = {
  matcher: [
    "/((?!_next|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml|woff|woff2|ttf)$).*)",
  ],
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Operation timed out after ${ms}ms`));
    }, ms);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error: unknown) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}
