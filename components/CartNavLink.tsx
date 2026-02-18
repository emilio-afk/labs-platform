"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CART_EVENT, readCartLabIds } from "@/utils/cartClient";

type CartNavLinkProps = {
  href?: string;
};

export default function CartNavLink({ href = "/cart" }: CartNavLinkProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const sync = () => {
      setCount(readCartLabIds().length);
    };
    sync();
    window.addEventListener(CART_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CART_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return (
    <Link
      href={href}
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--ast-sky)]/45 text-[var(--ast-sky)] hover:bg-[var(--ast-sky)]/10 transition"
      aria-label="Carrito"
      title="Carrito"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="9" cy="20" r="1" />
        <circle cx="17" cy="20" r="1" />
        <path d="M3 4h2l2.2 10.3a2 2 0 0 0 2 1.7h7.6a2 2 0 0 0 2-1.6L21 7H7" />
      </svg>
      {count > 0 && (
        <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--ast-mint)] px-1.5 text-[10px] font-bold text-[var(--ast-black)]">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
