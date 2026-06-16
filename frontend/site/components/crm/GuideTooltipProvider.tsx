"use client";

import { useEffect, useRef, useState } from "react";

type TooltipState = {
  text: string;
  x: number;
  y: number;
};

export default function GuideTooltipProvider() {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    function clearTimer() {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    function hideTooltip() {
      clearTimer();
      setTooltip(null);
    }

    function onMouseOver(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const guideEl = target.closest("[data-guide]") as HTMLElement | null;
      if (!guideEl) return;

      const text = guideEl.getAttribute("data-guide");
      if (!text) return;
      clearTimer();
      setTooltip(null);
      timerRef.current = window.setTimeout(() => {
        const rect = guideEl.getBoundingClientRect();
        setTooltip({
          text,
          x: rect.left + rect.width / 2,
          y: rect.bottom + 10,
        });
      }, 5000);
    }

    function onMouseOut(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const guideEl = target.closest("[data-guide]") as HTMLElement | null;
      if (!guideEl) return;
      hideTooltip();
    }

    function onScrollOrResize() {
      if (tooltip) setTooltip(null);
    }

    document.addEventListener("mouseover", onMouseOver);
    document.addEventListener("mouseout", onMouseOut);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      clearTimer();
      document.removeEventListener("mouseover", onMouseOver);
      document.removeEventListener("mouseout", onMouseOut);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [tooltip]);

  if (!tooltip) return null;

  return (
    <div
      className="fixed z-[120] -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-xl max-w-xs"
      style={{ left: tooltip.x, top: tooltip.y }}
      role="status"
      aria-live="polite"
    >
      {tooltip.text}
    </div>
  );
}
