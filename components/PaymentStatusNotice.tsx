"use client";

import { useEffect, useState } from "react";
import { removeLabsFromCart } from "@/utils/cartClient";

export default function PaymentStatusNotice({
  message,
  tone = "error",
  clearCartLabIds = [],
}: {
  message: string;
  tone?: "success" | "error";
  clearCartLabIds?: string[];
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (clearCartLabIds.length > 0) {
      removeLabsFromCart(clearCartLabIds);
    }

    const hideTimer = setTimeout(() => {
      setVisible(false);
      removePaymentQueryParams();
    }, 5000);

    return () => {
      clearTimeout(hideTimer);
    };
  }, [clearCartLabIds]);

  if (!visible) return null;

  return (
    <div
      className={`mb-4 rounded-lg px-4 py-3 text-sm text-[var(--ui-text)] transition-opacity duration-300 ${
        tone === "success"
          ? "border border-emerald-400/45 bg-emerald-950/30"
          : "border border-[var(--ast-coral)]/45 bg-[rgba(136,31,0,0.28)]"
      }`}
    >
      {message}
    </div>
  );
}

function removePaymentQueryParams() {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  url.searchParams.delete("payment");
  url.searchParams.delete("lab");
  url.searchParams.delete("labs");
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, "", nextUrl);
}
