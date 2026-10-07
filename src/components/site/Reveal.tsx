"use client";
import { useEffect, useRef, useState } from "react";

export type Variant = "up" | "left" | "right" | "zoom" | "blur";

/** Memunculkan konten dengan animasi halus saat masuk ke layar. */
export default function Reveal({
  children, delay = 0, className = "", as: Tag = "div", variant = "up", immediate = false,
}: { children: React.ReactNode; delay?: number; className?: string; as?: "div" | "section" | "li" | "article"; variant?: Variant; immediate?: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || immediate) return;
    if (typeof IntersectionObserver === "undefined") { setOn(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const Comp = Tag as React.ElementType;
  if (immediate) return <Comp className={`reveal-now ${className}`} style={{ animationDelay: `${delay}ms` }}>{children}</Comp>;
  return (
    <Comp ref={ref} data-v={variant} className={`reveal ${on ? "in" : ""} ${className}`} style={{ transitionDelay: on ? `${delay}ms` : "0ms" }}>
      {children}
    </Comp>
  );
}
