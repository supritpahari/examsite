/* Hallmark · genre: playful · theme: Hum · design-system: design.md · designed-as-app
 * Whisper of formula watermarks — ink at ~5% behind content, or cream at ~6% on dark panels.
 * Pure inline styles: works inside global-error (no global CSS) and outside token scope.
 * aria-hidden always; never interactive; static (no motion). */
function FormulaMarks({ variant = "light" }: { variant?: "light" | "dark" }) {
  const color =
    variant === "dark" ? "oklch(97% 0.012 95 / 0.11)" : "oklch(20% 0.012 250 / 0.095)";

  const marks: Array<{
    t: string;
    left: string;
    top: string;
    size: string;
    rot: number;
    mono?: boolean;
    hideSm?: boolean;
  }> = [
    { t: "F = ma", left: "4%", top: "8%", size: "2.5rem", rot: -8, mono: true },
    { t: "ψ", left: "30%", top: "5%", size: "3.6rem", rot: 0, hideSm: true },
    { t: "Σ", left: "86%", top: "6%", size: "5.2rem", rot: 6, hideSm: true },
    { t: "v = u + at", left: "38%", top: "15%", size: "1.5rem", rot: -4, mono: true },
    { t: "E = mc²", left: "70%", top: "18%", size: "1.7rem", rot: 5, mono: true },
    { t: "∂ψ/∂t", left: "8%", top: "22%", size: "2.7rem", rot: 0, hideSm: true },
    { t: "ΣF = 0", left: "60%", top: "28%", size: "1.2rem", rot: 8, mono: true, hideSm: true },
    { t: "∫", left: "84%", top: "31%", size: "4.2rem", rot: -6, hideSm: true },
    { t: "λ = h/p", left: "6%", top: "33%", size: "1.6rem", rot: 4, mono: true },
    { t: "g = 9.8 m/s²", left: "44%", top: "33%", size: "1.3rem", rot: -7, mono: true, hideSm: true },
    { t: "Φ = BA", left: "20%", top: "41%", size: "1.4rem", rot: 3, mono: true, hideSm: true },
    { t: "∇·B = 0", left: "27%", top: "48%", size: "1.5rem", rot: -6, mono: true },
    { t: "τ = Iα", left: "84%", top: "44%", size: "1.4rem", rot: -5, mono: true, hideSm: true },
    { t: "Δx·Δp ≥ ħ/2", left: "56%", top: "46%", size: "1.3rem", rot: -3, mono: true, hideSm: true },
    { t: "π", left: "90%", top: "55%", size: "3.8rem", rot: 10, hideSm: true },
    { t: "PV = nRT", left: "10%", top: "56%", size: "1.9rem", rot: 7, mono: true },
    { t: "p = mv", left: "34%", top: "62%", size: "1.7rem", rot: 5, mono: true },
    { t: "E = hf", left: "66%", top: "61%", size: "2.1rem", rot: -5, mono: true },
    { t: "Δt", left: "82%", top: "68%", size: "1.8rem", rot: 12, mono: true },
    { t: "√", left: "48%", top: "70%", size: "3rem", rot: 3, hideSm: true },
    { t: "Ω", left: "7%", top: "74%", size: "3.2rem", rot: -10, hideSm: true },
    { t: "½mv²", left: "14%", top: "88%", size: "1.7rem", rot: -3, mono: true },
    { t: "ω = 2πf", left: "52%", top: "86%", size: "1.9rem", rot: 2, mono: true, hideSm: true },
    { t: "a = g", left: "78%", top: "86%", size: "1.6rem", rot: 6, mono: true },
  ];

  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        userSelect: "none",
        zIndex: -1,
      }}
    >
      <style>{`@media (max-width: 640px) { .fm-hide-sm { display: none; } }`}</style>
      {marks.map((m, i) => (
        <span
          key={i}
          className={m.hideSm ? "fm-hide-sm" : undefined}
          style={{
            position: "absolute",
            left: m.left,
            top: m.top,
            fontSize: m.size,
            transform: `rotate(${m.rot}deg)`,
            color,
            fontFamily: m.mono
              ? "'JetBrains Mono', ui-monospace, Menlo, monospace"
              : "'Plus Jakarta Sans', system-ui, sans-serif",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            whiteSpace: "nowrap",
            lineHeight: 1,
          }}
        >
          {m.t}
        </span>
      ))}
    </div>
  );
}

export default FormulaMarks;
