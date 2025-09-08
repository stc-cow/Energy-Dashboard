import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

interface Props {
  children: React.ReactNode;
  /** Baseline content width before scaling (px). Should match container max width */
  baseWidth?: number;
  /** Space to reserve for header (px) */
  topOffset?: number;
  /** Space to reserve for footer or bottom margin (px) */
  bottomOffset?: number;
  /** Only apply scaling when viewport width >= this (px) */
  enableAtWidth?: number;
}

export default function FitToScreen({
  children,
  baseWidth = 1400,
  topOffset = 80,
  bottomOffset = 96,
  enableAtWidth = 1280,
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState<number>(1);

  const enabled =
    typeof window !== "undefined" && window.innerWidth >= enableAtWidth;

  function recalc() {
    const el = wrapRef.current;
    if (!el) return;
    // Temporarily measure at scale=1
    el.style.transform = "none";
    el.style.width = `${baseWidth}px`;
    const rect = el.getBoundingClientRect();
    const contentHeight = rect.height || 1;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const wScale = vw / baseWidth;
    const hScale = (vh - topOffset - bottomOffset) / contentHeight;
    const s = Math.max(0.5, Math.min(wScale, hScale));
    setScale(s);
    // Apply transform after measuring
    el.style.transform = `scale(${s})`;
  }

  useLayoutEffect(() => {
    if (!enabled) return;
    recalc();
    // observe size changes
    const ro = new ResizeObserver(() => recalc());
    if (wrapRef.current) ro.observe(wrapRef.current);
    const onResize = () => recalc();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, baseWidth, topOffset, bottomOffset]);

  const style: React.CSSProperties = useMemo(() => {
    if (!enabled) return { width: "100%" };
    return {
      width: baseWidth,
      margin: "0 auto",
      transformOrigin: "top center",
    } as React.CSSProperties;
  }, [enabled, baseWidth]);

  if (!enabled) return <>{children}</>;

  return (
    <div ref={wrapRef} style={style}>
      {children}
    </div>
  );
}
