"use client";

import { useEffect, useState } from "react";

export default function PaymentStatusNotice({ message }: { message: string }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const hideTimer = setTimeout(() => {
      setVisible(false);
      removePaymentQueryParams();
    }, 5000);

    return () => {
      clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="mb-4 rounded-lg border border-[var(--ast-coral)]/50 bg-[var(--ast-rust)]/30 px-4 py-3 text-sm text-[var(--ast-bone)] transition-opacity duration-300">
      {message}
    </div>
  );
}

function removePaymentQueryParams() {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  url.searchParams.delete("payment");
  url.searchParams.delete("lab");
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, "", nextUrl);
}
