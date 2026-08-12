const GREEK: Record<string, string> = {
  alpha: "α",
  beta: "β",
  gamma: "γ",
  delta: "δ",
  epsilon: "ε",
  varepsilon: "ε",
  zeta: "ζ",
  eta: "η",
  theta: "θ",
  vartheta: "ϑ",
  iota: "ι",
  kappa: "κ",
  lambda: "λ",
  mu: "μ",
  nu: "ν",
  xi: "ξ",
  pi: "π",
  rho: "ρ",
  sigma: "σ",
  tau: "τ",
  upsilon: "υ",
  phi: "φ",
  varphi: "ϕ",
  chi: "χ",
  psi: "ψ",
  omega: "ω",
  Gamma: "Γ",
  Delta: "Δ",
  Theta: "Θ",
  Lambda: "Λ",
  Xi: "Ξ",
  Pi: "Π",
  Sigma: "Σ",
  Phi: "Φ",
  Psi: "Ψ",
  Omega: "Ω",
};

const SYM: Record<string, string> = {
  times: "×",
  cdot: "·",
  div: "÷",
  pm: "±",
  mp: "∓",
  ast: "∗",
  star: "⋆",
  circ: "∘",
  bullet: "∙",
  oplus: "⊕",
  otimes: "⊗",
  leq: "≤",
  geq: "≥",
  le: "≤",
  ge: "≥",
  neq: "≠",
  approx: "≈",
  equiv: "≡",
  propto: "∝",
  sim: "∼",
  simeq: "≃",
  cong: "≅",
  ll: "≪",
  gg: "≫",
  in: "∈",
  notin: "∉",
  subset: "⊂",
  supset: "⊃",
  subseteq: "⊆",
  supseteq: "⊇",
  cup: "∪",
  cap: "∩",
  emptyset: "∅",
  forall: "∀",
  exists: "∃",
  infty: "∞",
  partial: "∂",
  nabla: "∇",
  hbar: "ℏ",
  ell: "ℓ",
  sum: "∑",
  prod: "∏",
  coprod: "∐",
  int: "∫",
  iint: "∬",
  iiint: "∭",
  oint: "∮",
  to: "→",
  rightarrow: "→",
  leftarrow: "←",
  leftrightarrow: "↔",
  uparrow: "↑",
  downarrow: "↓",
  Rightarrow: "⇒",
  Leftarrow: "⇐",
  Leftrightarrow: "⇔",
  mapsto: "↦",
  deg: "°",
  angle: "∠",
  perp: "⊥",
  parallel: "∥",
  langle: "⟨",
  rangle: "⟩",
  cdots: "⋯",
  ldots: "…",
  vdots: "⋮",
  ddots: "⋱",
  prime: "′",
  lbrace: "{",
  rbrace: "}",
};

const FUNCS = [
  "sin",
  "cos",
  "tan",
  "cot",
  "sec",
  "csc",
  "sinh",
  "cosh",
  "tanh",
  "coth",
  "log",
  "ln",
  "lg",
  "exp",
  "lim",
  "det",
  "dim",
  "mod",
  "gcd",
  "lcm",
  "min",
  "max",
  "arg",
];

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function replaceSymbols(s: string): string {
  for (const [k, v] of Object.entries(GREEK)) {
    s = s.replace(new RegExp("\\\\" + k + "\\b", "g"), v);
  }
  for (const [k, v] of Object.entries(SYM)) {
    s = s.replace(new RegExp("\\\\" + k + "\\b", "g"), v);
  }
  for (const f of FUNCS) {
    s = s.replace(
      new RegExp("\\\\" + f + "\\b", "g"),
      '<i class="fn">' + f + "</i>"
    );
  }
  s = s.replace(/\\text\s*\{([^{}]*)\}/g, "$1");
  s = s.replace(/\\[td]?frac/g, "\\frac");
  s = s.replace(/\\left\.?/g, "").replace(/\\right\.?/g, "");
  s = s.replace(/\\quad|\\qquad/g, "  ").replace(/\\[,;: ]/g, " ");
  return s;
}

function expand(s: string): string {
  s = s.replace(
    /\\sqrt\[[^{}]*\]\{([^{}]*)\}/g,
    (_m, x) =>
      '<span class="sqrt"><span class="sym">√</span><span class="body">' +
      expand(x) +
      "</span></span>"
  );
  s = s.replace(
    /\\sqrt\{([^{}]*)\}/g,
    (_m, x) =>
      '<span class="sqrt"><span class="sym">√</span><span class="body">' +
      expand(x) +
      "</span></span>"
  );
  s = s.replace(
    /\\overline\{([^{}]*)\}/g,
    (_m, x) => '<span class="oline">' + expand(x) + "</span>"
  );
  s = s.replace(
    /\\bar\{([^{}]*)\}/g,
    (_m, x) => '<span class="oline">' + expand(x) + "</span>"
  );
  s = s.replace(
    /\\frac\{([^{}]*)\}\{([^{}]*)\}/g,
    (_m, n, d) =>
      '<span class="frac"><span class="num">' +
      expand(n) +
      '</span><span class="den">' +
      expand(d) +
      "</span></span>"
  );
  s = s.replace(/\^\{([^{}]*)\}/g, (_m, x) => "<sup>" + expand(x) + "</sup>");
  s = s.replace(/\^([A-Za-z0-9]+)/g, (_m, x) => "<sup>" + expand(x) + "</sup>");
  s = s.replace(/_\{([^{}]*)\}/g, (_m, x) => "<sub>" + expand(x) + "</sub>");
  s = s.replace(/_([A-Za-z0-9]+)/g, (_m, x) => "<sub>" + expand(x) + "</sub>");
  return s;
}

function processDeep(s: string): string {
  let prev = "";
  let out = s;
  let guard = 0;
  while (out !== prev && guard < 40) {
    prev = out;
    out = expand(out);
    guard++;
  }
  return out;
}

export function renderMathHtml(text: string): string {
  if (!text) return "";
  let s = text;
  s = s.replace(/\$/g, "").replace(/\\\(/g, "").replace(/\\\)/g, "");
  s = escapeHtml(s);
  s = replaceSymbols(s);
  s = processDeep(s);
  s = s.replace(/\\[a-zA-Z]+/g, "");
  s = s.replace(/[{}]/g, "");
  return s;
}

const IMAGE_EXT_RE = /\.(?:png|jpe?g|gif|webp|svg|bmp|avif)(?:\?[^\s()<>"']*)?/i;

export function extractImageUrls(text: string): string[] {
  if (!text) return [];
  const urls: string[] = [];
  for (const m of text.matchAll(/!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    urls.push(m[1].trim());
  }
  const bare = text.matchAll(
    /https?:\/\/[^\s()<>"'\]]+/gi
  );
  for (const m of bare) {
    const clean = m[0].replace(/[.,;:]+$/, "");
    if (IMAGE_EXT_RE.test(clean)) {
      urls.push(clean);
    }
  }
  return [...new Set(urls)];
}
