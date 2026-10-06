"use client";
import { useEffect, useRef, useState } from "react";

/** Memunculkan konten dengan animasi halus saat masuk ke layar. */
export default function Reveal({
  children, delay = 0, className = "", as: Tag = "div",
}: { children: React.ReactNode; delay?: number; className?: string; as?: "div" | "section" | "li" | "article" }) {
  const ref = useRef<HTMLElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setOn(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const Comp = Tag as React.ElementType;
  return (
    <Comp ref={ref} className={`reveal ${on ? "in" : ""} ${className}`} style={{ transitionDelay: on ? `${delay}ms` : "0ms" }}>
      {children}
    </Comp>
  );
}
