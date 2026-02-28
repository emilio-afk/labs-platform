"use client";

import { useEffect, useRef } from "react";

type Dot = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hue: number;
};

const MIN_DOTS = 22;
const MAX_DOTS = 56;
const LINK_DISTANCE = 148;
const SPEED_LIMIT = 0.09;

export default function ConnectedDotsBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId = 0;
    let dots: Dot[] = [];
    let width = 0;
    let height = 0;

    const randomRange = (min: number, max: number) =>
      Math.random() * (max - min) + min;

    const clampSpeed = (value: number) =>
      Math.max(-SPEED_LIMIT, Math.min(SPEED_LIMIT, value));

    const setupCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const densityTarget = Math.floor((width * height) / 47000);
      const dotCount = Math.max(MIN_DOTS, Math.min(MAX_DOTS, densityTarget));

      dots = Array.from({ length: dotCount }, () => ({
        x: randomRange(0, width),
        y: randomRange(0, height),
        vx: randomRange(-0.035, 0.035),
        vy: randomRange(-0.035, 0.035),
        radius: randomRange(1.3, 2.6),
        hue: randomRange(170, 225),
      }));
    };

    const drawFrame = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < dots.length; i += 1) {
        const dot = dots[i];

        if (!reducedMotion) {
          dot.vx = clampSpeed((dot.vx + randomRange(-0.0035, 0.0035)) * 0.998);
          dot.vy = clampSpeed((dot.vy + randomRange(-0.0035, 0.0035)) * 0.998);
          dot.x += dot.vx;
          dot.y += dot.vy;
        }

        if (dot.x < 0 || dot.x > width) {
          dot.vx *= -1;
          dot.x = Math.max(0, Math.min(width, dot.x));
        }
        if (dot.y < 0 || dot.y > height) {
          dot.vy *= -1;
          dot.y = Math.max(0, Math.min(height, dot.y));
        }
      }

      const maxDistSquared = LINK_DISTANCE * LINK_DISTANCE;
      for (let i = 0; i < dots.length; i += 1) {
        const a = dots[i];
        for (let j = i + 1; j < dots.length; j += 1) {
          const b = dots[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distSquared = dx * dx + dy * dy;
          if (distSquared > maxDistSquared) continue;

          const distance = Math.sqrt(distSquared);
          const intensity = 1 - distance / LINK_DISTANCE;
          const alpha = intensity * intensity * 0.1;
          const hue = (a.hue + b.hue) / 2;

          ctx.strokeStyle = `hsla(${hue}, 88%, 66%, ${alpha})`;
          ctx.lineWidth = 0.5 + intensity * 0.45;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      for (const dot of dots) {
        const glow = ctx.createRadialGradient(dot.x, dot.y, 0, dot.x, dot.y, dot.radius * 4);
        glow.addColorStop(0, `hsla(${dot.hue}, 96%, 70%, 0.36)`);
        glow.addColorStop(1, `hsla(${dot.hue}, 96%, 70%, 0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.radius * 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `hsla(${dot.hue}, 96%, 78%, 0.62)`;
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      rafId = window.requestAnimationFrame(drawFrame);
    };

    const onResize = () => {
      setupCanvas();
    };

    setupCanvas();
    drawFrame();
    window.addEventListener("resize", onResize);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        className="h-full w-full opacity-30 [mask-image:radial-gradient(ellipse_at_center,transparent_26%,rgba(0,0,0,0.5)_58%,black_100%)]"
      />
    </div>
  );
}
