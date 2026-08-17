import { jsPDF } from "jspdf";
import { extractImageUrls } from "./render-math";
import { DEJAVU_SANS_REGULAR_B64 } from "./fonts/dejavu-sans";
import { DEJAVU_SANS_BOLD_B64 } from "./fonts/dejavu-sans-bold";
import { HIND_SILIGURI_REGULAR_B64 } from "./fonts/hind-siliguri-reg";
import { HIND_SILIGURI_BOLD_B64 } from "./fonts/hind-siliguri-bold";

/* ------------------------------------------------------------------ *
 * LaTeX-ish source → readable Unicode plain text for the PDF writer. *
 * jsPDF does no text shaping, so we resolve everything to simple     *
 * Unicode glyphs covered by the bundled DejaVu Sans font.            *
 * ------------------------------------------------------------------ */

const GREEK: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε",
  zeta: "ζ", eta: "η", theta: "θ", vartheta: "ϑ", iota: "ι", kappa: "κ",
  lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", pi: "π", rho: "ρ", sigma: "σ",
  tau: "τ", upsilon: "υ", phi: "φ", varphi: "ϕ", chi: "χ", psi: "ψ", omega: "ω",
  Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π",
  Sigma: "Σ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
};

const SYM: Record<string, string> = {
  times: "×", cdot: "·", div: "÷", pm: "±", mp: "∓", ast: "∗", star: "⋆",
  circ: "∘", bullet: "∙", leq: "≤", geq: "≥", le: "≤", ge: "≥", neq: "≠",
  approx: "≈", equiv: "≡", propto: "∝", sim: "∼", simeq: "≃", cong: "≅",
  ll: "≪", gg: "≫", in: "∈", notin: "∉", subset: "⊂", supset: "⊃",
  subseteq: "⊆", supseteq: "⊇", cup: "∪", cap: "∩", emptyset: "∅",
  forall: "∀", exists: "∃", infty: "∞", partial: "∂", nabla: "∇", hbar: "ℏ",
  sum: "∑", prod: "∏", int: "∫", iint: "∬", oint: "∮", to: "→",
  rightarrow: "→", leftarrow: "←", leftrightarrow: "↔", uparrow: "↑",
  downarrow: "↓", Rightarrow: "⇒", Leftarrow: "⇐", Leftrightarrow: "⇔",
  mapsto: "↦", deg: "°", angle: "∠", perp: "⊥", parallel: "∥",
  langle: "⟨", rangle: "⟩", cdots: "⋯", ldots: "…", prime: "′",
  lbrace: "{", rbrace: "}",
};

const FUNCS = [
  "sin", "cos", "tan", "cot", "sec", "csc", "cosec", "sinh", "cosh", "tanh",
  "coth", "log", "ln", "lg", "exp", "lim", "det", "mod", "gcd", "min", "max", "arg",
];

const SUPERSCRIPT: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵",
  "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻",
  "=": "⁼", "(": "⁽", ")": "⁾", n: "ⁿ", i: "ⁱ",
};

const SUBSCRIPT: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅",
  "6": "₆", "7": "₇", "8": "₈", "9": "₉", "+": "₊", "-": "₋",
  "=": "₌", "(": "₍", ")": "₎", a: "ₐ", e: "ₑ", o: "ₒ", x: "ₓ",
  h: "ₕ", k: "ₖ", l: "ₗ", m: "ₘ", n: "ₙ", p: "ₚ", s: "ₛ", t: "ₜ",
};

function toScripts(body: string, map: Record<string, string>): string | null {
  let out = "";
  for (const ch of body) {
    const rep = map[ch];
    if (!rep) return null;
    out += rep;
  }
  return out;
}

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

function parsePlain(str: string): string {
  let out = "";
  let i = 0;
  while (i < str.length) {
    const c = str[i];
    if (c === "\\") {
      let j = i + 1;
      while (j < str.length && /[a-zA-Z]/.test(str[j])) j++;
      const cmd = str.slice(i + 1, j);
      if (cmd === "") {
        // \ , \; \: \/ (spacing) — emit a space; for anything else just drop the backslash
        const next = str[j] ?? "";
        out += ",;:!/ ".includes(next) ? " " : next;
        i = j + (next ? 1 : 0);
        continue;
      }
      if (cmd === "frac" || cmd === "dfrac" || cmd === "tfrac") {
        const [num, n1] = readGroup(str, j);
        const [den, n2] = readGroup(str, n1);
        i = n2;
        out += `(${parsePlain(num)})/(${parsePlain(den)})`;
        continue;
      }
      if (cmd === "sqrt") {
        if (str[j] === "[") {
          const close = str.indexOf("]", j);
          if (close !== -1) {
            const n = str.slice(j + 1, close);
            const [body, n2] = readGroup(str, close + 1);
            i = n2;
            out += `[${parsePlain(n)}]√(${parsePlain(body)})`;
            continue;
          }
        }
        const [body, n1] = readGroup(str, j);
        i = n1;
        out += `√(${parsePlain(body)})`;
        continue;
      }
      if (cmd === "vec" || cmd === "overrightarrow") {
        const [body, n1] = readGroup(str, j);
        i = n1;
        out += parsePlain(body) + "⃗";
        continue;
      }
      if (cmd === "hat") {
        const [body, n1] = readGroup(str, j);
        i = n1;
        out += parsePlain(body) + "̂";
        continue;
      }
      if (cmd === "bar" || cmd === "overline") {
        const [body, n1] = readGroup(str, j);
        i = n1;
        out += parsePlain(body) + "‾";
        continue;
      }
      if (cmd === "text" || cmd === "mathrm" || cmd === "mathbf" || cmd === "mathit" || cmd === "mathrmnormal") {
        const [body, n1] = readGroup(str, j);
        i = n1;
        out += parsePlain(body);
        continue;
      }
      if (cmd === "left" || cmd === "right") {
        const delim = str[j] ?? "";
        i = j + (/[.[\]()|]/.test(delim) ? 1 : 0);
        out += delim === "." ? "" : /[[\]()|]/.test(delim) ? delim : "";
        continue;
      }
      if (cmd === "quad" || cmd === "qquad") { out += "  "; i = j; continue; }
      if (cmd === " " || cmd === "," || cmd === ";" || cmd === ":") { out += " "; i = j; continue; }
      if (cmd in GREEK) { out += GREEK[cmd]; i = j; continue; }
      if (FUNCS.includes(cmd)) {
        out += (out && /[A-Za-z0-9)\]]$/.test(out) ? " " : "") + cmd;
        i = j;
        continue;
      }
      if (SYM[cmd]) { out += SYM[cmd]; i = j; continue; }
      if (cmd) { out += cmd; i = j; continue; }
      i = j;
      continue;
    }
    if (c === "^" || c === "_") {
      const [body, n1] = readGroup(str, i + 1);
      i = n1;
      const inner = parsePlain(body);
      const scripted = toScripts(inner, c === "^" ? SUPERSCRIPT : SUBSCRIPT);
      if (scripted) out += scripted;
      else if (c === "^" && (inner === "∘" || inner === "°")) out += "°";
      else if (c === "^" && inner.length > 1) out += `^(${inner})`;
      else out += c + inner;
      continue;
    }
    if (c === "{") {
      const [body, n1] = readGroup(str, i);
      i = n1;
      out += parsePlain(body);
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** Convert stored LaTeX-ish question text into readable Unicode text. */
export function mathToPlainText(input: string): string {
  if (!input) return "";
  return parsePlain(
    input.replace(/\$/g, "").replace(/\\\(/g, "").replace(/\\\)/g, "")
  )
    .replace(/!\[[^\]]*\]\([^)\s]+(?:\s+"[^"]*")?\)/g, "") // strip markdown images (embedded separately)
    .replace(/https?:\/\/\S+\.(?:png|jpe?g|gif|webp|svg|bmp|avif)(?:\?\S*)?/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/* ------------------------------------------------------------------ */

export interface PdfQuestion {
  prompt: string;
  marks: number;
  negative: number;
  imageUrl?: string;
  options: { text: string; imageUrl?: string }[];
}

export interface PdfExamInfo {
  examTitle: string;
  subject: string;
  duration: string;
  code: string;
  studentName: string;
  questions: PdfQuestion[];
}

const PAGE = { w: 210, h: 297 }; // A4, mm
const MARGIN = 16;
const CONTENT_W = PAGE.w - MARGIN * 2;
const BOTTOM = PAGE.h - 14;

/** Bengali script (U+0980–U+09FF). DejaVu Sans has no Bengali glyphs, so we
 *  switch to Hind Siliguri whenever a block contains Bengali characters. */
const BENGALI_RE = /[\u0980-\u09FF]/;
function hasBengali(s: string): boolean {
  return BENGALI_RE.test(s);
}
function pickFamily(s: string): string {
  return hasBengali(s) ? "HindSiliguri" : "DejaVuSans";
}

async function fetchImageData(
  url: string
): Promise<{ dataUrl: string; ratio: number } | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(new Error("read failed"));
      fr.readAsDataURL(blob);
    });
    const ratio = await new Promise<number>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : 1.6);
      img.onerror = () => resolve(1.6);
      img.src = dataUrl;
    });
    return { dataUrl, ratio };
  } catch {
    return null;
  }
}

export async function downloadExamQuestionsPdf(info: PdfExamInfo): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  doc.addFileToVFS("DejaVuSans.ttf", DEJAVU_SANS_REGULAR_B64);
  doc.addFont("DejaVuSans.ttf", "DejaVuSans", "normal");
  doc.addFileToVFS("DejaVuSans-Bold.ttf", DEJAVU_SANS_BOLD_B64);
  doc.addFont("DejaVuSans-Bold.ttf", "DejaVuSans", "bold");
  doc.addFileToVFS("HindSiliguri.ttf", HIND_SILIGURI_REGULAR_B64);
  doc.addFont("HindSiliguri.ttf", "HindSiliguri", "normal");
  doc.addFileToVFS("HindSiliguri-Bold.ttf", HIND_SILIGURI_BOLD_B64);
  doc.addFont("HindSiliguri-Bold.ttf", "HindSiliguri", "bold");
  doc.setFont("DejaVuSans", "normal");

  let y = MARGIN;

  const footer = () => {
    const total = doc.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      doc.setPage(p);
      doc.setFont("DejaVuSans", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(140, 132, 115);
      const brand = `World of Physics · ${info.examTitle}`;
      doc.setFont(pickFamily(brand), "normal");
      doc.text(brand, MARGIN, PAGE.h - 8);
      const label = `Page ${p} of ${total}`;
      doc.text(label, PAGE.w - MARGIN - doc.getTextWidth(label), PAGE.h - 8);
      doc.setTextColor(20, 17, 13);
    }
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > BOTTOM) {
      doc.addPage();
      y = MARGIN;
    }
  };

  const writeWrapped = (
    text: string,
    opts: { size?: number; bold?: boolean; indent?: number; color?: [number, number, number]; gap?: number } = {}
  ) => {
    const size = opts.size ?? 10.5;
    const indent = opts.indent ?? 0;
    const gap = opts.gap ?? 1.6;
    const bn = hasBengali(text);
    doc.setFont(pickFamily(text), opts.bold ? "bold" : "normal");
    doc.setFontSize(size);
    if (opts.color) doc.setTextColor(...opts.color);
    const lines = doc.splitTextToSize(text, CONTENT_W - indent) as string[];
    const lineH = size * (bn ? 0.48 : 0.42);
    for (const line of lines) {
      ensureSpace(lineH);
      doc.text(line, MARGIN + indent, y);
      y += lineH;
    }
    y += gap;
    doc.setTextColor(20, 17, 13);
    doc.setFont("DejaVuSans", "normal");
  };

  /* ------ Header ------ */
  doc.setFont("DejaVuSans", "bold");
  doc.setFontSize(17);
  doc.text("World of Physics", MARGIN, y);
  y += 8;
  writeWrapped(info.examTitle, { size: 13, bold: true, gap: 1 });
  writeWrapped(
    `${info.subject} · ${info.duration} · Code: ${info.code}`,
    { size: 9.5, color: [110, 102, 90], gap: 1 }
  );
  writeWrapped(
    `Candidate: ${info.studentName}   ·   ${info.questions.length} questions   ·   Downloaded ${new Date().toLocaleString()}`,
    { size: 9.5, color: [110, 102, 90], gap: 2 }
  );
  ensureSpace(6);
  doc.setDrawColor(20, 17, 13);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, PAGE.w - MARGIN, y);
  y += 7;

  /* ------ Questions ------ */
  for (let qi = 0; qi < info.questions.length; qi++) {
    const q = info.questions[qi];
    const markLabel = `[+${q.marks}${q.negative ? `, −${q.negative}` : ""}]`;

    // Question number + marks on one bold line, then the prompt.
    ensureSpace(12);
    writeWrapped(`Q${qi + 1}. ${markLabel}`, { bold: true, size: 11, gap: 0.5 });
    writeWrapped(mathToPlainText(q.prompt) || "(question text unavailable)", {
      size: 10.5,
      gap: 1.5,
    });

    // Figures (best effort — skipped silently if the host blocks embedding).
    const urls = Array.from(
      new Set([...(q.imageUrl ? [q.imageUrl] : []), ...extractImageUrls(q.prompt)])
    );
    for (const url of urls) {
      const img = await fetchImageData(url);
      if (!img) {
        writeWrapped("[A figure in this question could not be embedded — view it in the online test.]", {
          size: 8.5,
          color: [150, 60, 40],
          indent: 4,
        });
        continue;
      }
      let w = Math.min(80, CONTENT_W);
      let h = w / img.ratio;
      if (h > 55) {
        h = 55;
        w = h * img.ratio;
      }
      ensureSpace(h + 2);
      try {
        doc.addImage(img.dataUrl, MARGIN + 2, y, w, h);
      } catch {
        /* unsupported format — skip */
      }
      y += h + 2.5;
    }

    // Options
    for (let oi = 0; oi < q.options.length; oi++) {
      const letter = String.fromCharCode(65 + oi);
      writeWrapped(`${letter}.  ${mathToPlainText(q.options[oi].text)}`, {
        indent: 7,
        size: 10,
        gap: 0.6,
      });
      const optUrl = q.options[oi].imageUrl;
      if (optUrl) {
        const img = await fetchImageData(optUrl);
        if (img) {
          let w = Math.min(55, CONTENT_W);
          let h = w / img.ratio;
          if (h > 38) {
            h = 38;
            w = h * img.ratio;
          }
          ensureSpace(h + 1);
          try {
            doc.addImage(img.dataUrl, MARGIN + 14, y, w, h);
          } catch {
            /* unsupported format — skip */
          }
          y += h + 1.5;
        }
      }
    }
    y += 3.5;
  }

  ensureSpace(10);
  doc.setFontSize(9);
  doc.setTextColor(140, 132, 115);
  doc.text("— End of question paper —", PAGE.w / 2, Math.min(y + 4, BOTTOM), {
    align: "center",
  });
  doc.setTextColor(20, 17, 13);

  footer();

  doc.save(`${(info.code || "exam").replace(/[^\w-]+/g, "_")}-question-paper.pdf`);
}
