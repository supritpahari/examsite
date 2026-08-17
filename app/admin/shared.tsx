"use client";

const GREEK: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", Delta: "Δ", epsilon: "ε",
  theta: "θ", Theta: "Θ", lambda: "λ", mu: "μ", pi: "π", Pi: "Π", rho: "ρ",
  sigma: "σ", Sigma: "Σ", tau: "τ", phi: "φ", Phi: "Φ", psi: "ψ", omega: "ω",
  Omega: "Ω", eta: "η", kappa: "κ", nu: "ν", xi: "ξ", zeta: "ζ", Gamma: "Γ",
};

const SIMPLE: Record<string, string> = {
  infty: "∞", to: "→", cdot: "·", times: "×", div: "÷", pm: "±", mp: "∓",
  leq: "≤", geq: "≥", neq: "≠", approx: "≈", equiv: "≡", propto: "∝",
  partial: "∂", nabla: "∇", sum: "∑", int: "∫", prod: "∏", cup: "∪", cap: "∩",
  in: "∈", notin: "∉", subset: "⊂", supset: "⊃", forall: "∀", exists: "∃",
  rightarrow: "→", leftarrow: "←", Rightarrow: "⇒", Leftarrow: "⇐",
  langle: "⟨", rangle: "⟩", ldots: "…", cdots: "⋯", ll: "«", gg: "»",
  angle: "∠", circ: "°", prime: "′",
};

function readGroup(str: string, i: number): [string, number] {
  if (str[i] !== "{") return [str[i] ?? "", i + 1];
  let depth = 0;
  let j = i;
  for (; j < str.length; j++) {
    if (str[j] === "{") depth++;
    else if (str[j] === "}") {
      depth--;
      if (depth === 0) return [str.slice(i + 1, j), j + 1];
    }
  }
  return [str.slice(i + 1), j];
}

function parseMath(str: string, keyBase = "m"): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let i = 0;
  let k = 0;
  const push = (n: React.ReactNode) => out.push(<span key={`${keyBase}-${k++}`}>{n}</span>);

  while (i < str.length) {
    const c = str[i];
    if (c === "\\") {
      let j = i + 1;
      while (j < str.length && /[a-zA-Z]/.test(str[j])) j++;
      const cmd = str.slice(i + 1, j);
      if (cmd === "frac") {
        const [num, n1] = readGroup(str, j);
        const [den, n2] = readGroup(str, n1);
        i = n2;
        push(
          <span key={`${keyBase}-${k++}`} className="nq-frac">
            <span className="nq-frac-num">{parseMath(num, keyBase + "n")}</span>
            <span className="nq-frac-den">{parseMath(den, keyBase + "d")}</span>
          </span>
        );
        continue;
      }
      if (cmd === "vec") {
        const [body, n1] = readGroup(str, j);
        i = n1;
        push(
          <span key={`${keyBase}-${k++}`} className="nq-vec">
            {parseMath(body, keyBase + "v")}
            <span className="nq-vec-arrow">⃗</span>
          </span>
        );
        continue;
      }
      if (cmd === "hat") {
        const [body, n1] = readGroup(str, j);
        i = n1;
        push(
          <span key={`${keyBase}-${k++}`} className="nq-hat">
            <span className="nq-hat-cap">ˆ</span>
            <span className="nq-hat-body">{parseMath(body, keyBase + "h")}</span>
          </span>
        );
        continue;
      }
      if (cmd === "sqrt") {
        const [body, n1] = readGroup(str, j);
        i = n1;
        push(
          <span key={`${keyBase}-${k++}`} className="nq-sqrt">
            √<span className="nq-sqrt-body">{parseMath(body, keyBase + "s")}</span>
          </span>
        );
        continue;
      }
      if (cmd === "text") {
        const [body, n1] = readGroup(str, j);
        i = n1;
        push(body);
        continue;
      }
      if (cmd in GREEK) { push(GREEK[cmd as keyof typeof GREEK]); i = j; continue; }
      if (SIMPLE[cmd]) { push(SIMPLE[cmd]); i = j; continue; }
      push(cmd);
      i = j;
      continue;
    }
    if (c === "^" || c === "_") {
      const [body, n1] = readGroup(str, i + 1);
      i = n1;
      push(
        c === "^" ? (
          <sup key={`${keyBase}-${k++}`}>{parseMath(body, keyBase + "sup")}</sup>
        ) : (
          <sub key={`${keyBase}-${k++}`}>{parseMath(body, keyBase + "sub")}</sub>
        )
      );
      continue;
    }
    if (c === "{") {
      const [body, n1] = readGroup(str, i);
      i = n1;
      push(parseMath(body, keyBase + "g"));
      continue;
    }
    push(c);
    i++;
  }
  return out;
}

export function MathPreview({ text, compact }: { text: string; compact?: boolean }) {
  if (typeof text !== "string" || !text.trim()) return null;
  const segments = text.split(/(\$[^$]*\$)/g).filter((s) => s !== "");
  const nodes = segments.map((seg, idx) => {
    if (seg.startsWith("$") && seg.endsWith("$") && seg.length >= 2) {
      return (
        <span key={idx} className="nq-prev-math">
          {parseMath(seg.slice(1, -1), "p" + idx)}
        </span>
      );
    }
    return <span key={idx}>{parseMath(seg, "p" + idx)}</span>;
  });
  return (
    <span className={compact ? "nq-preview-inline" : "nq-preview-body"}>{nodes}</span>
  );
}

export function Stepper({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step?: number;
  min?: number;
}) {
  const num = Number(value) || 0;
  const set = (v: number) => onChange(String(Math.max(min, v)));
  return (
    <div className="nq-field">
      {label && <label>{label}</label>}
      <div className="nq-stepper">
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => {
            const cleaned = e.target.value.replace(/[^0-9.-]/g, "");
            onChange(cleaned);
          }}
        />
        <div className="nq-stepper-btns">
          <button type="button" aria-label={`Increase ${label}`} onClick={() => set(num + step)}>▲</button>
          <button type="button" aria-label={`Decrease ${label}`} onClick={() => set(num - step)}>▼</button>
        </div>
      </div>
    </div>
  );
}