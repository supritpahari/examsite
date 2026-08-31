import { jsPDF } from "jspdf";
import { extractImageUrls } from "./render-math";
import { DEJAVU_SANS_REGULAR_B64 } from "./fonts/dejavu-sans";
import { DEJAVU_SANS_BOLD_B64 } from "./fonts/dejavu-sans-bold";
import { HIND_SILIGURI_REGULAR_B64 } from "./fonts/hind-siliguri-reg";
import { HIND_SILIGURI_BOLD_B64 } from "./fonts/hind-siliguri-bold";
import {
  loadShaper,
  type Shaper,
  type ShaperFamily,
  type ShaperFont,
  type ShaperStyle,
  type ShapedGlyph,
} from "./bengali-shaper";

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
const PT_TO_MM = 25.4 / 72;

/** Bengali script (U+0980–U+09FF), danda/double danda (U+0964/65) and
 *  joiners. DejaVu Sans has no Bengali glyphs, so we shape with Hind Siliguri
 *  (via HarfBuzz) whenever a block contains Bengali characters. */
const BENGALI_RE = /[\u0980-\u09FF\u0964\u0965\u200C\u200D]/;
function hasBengali(s: string): boolean {
  return BENGALI_RE.test(s);
}
function isBengaliChar(ch: string): boolean {
  return BENGALI_RE.test(ch);
}
function pickFamily(s: string): string {
  return hasBengali(s) ? "HindSiliguri" : "DejaVuSans";
}

/* ------------------------------------------------------------------ *
 * Shaped (HarfBuzz) text pipeline.                                    *
 *                                                                     *
 * jsPDF writes raw glyph ids for embedded TTF fonts (Identity-H with  *
 * /CIDToGIDMap /Identity), but it chooses those ids through the       *
 * font's cmap, one glyph per character, in logical order — so Bengali *
 * conjuncts never form and pre-base matras (ি ে) land after their     *
 * consonant. Here we shape the text properly with HarfBuzz and feed   *
 * jsPDF the resulting glyph ids directly.                             *
 * ------------------------------------------------------------------ */

/** BMP private-use codepoint we address a glyph through for one draw call. */
const PUA_BASE = 0xe000;
/** PUA is 6400 codepoints wide; every bundled font has fewer glyphs than that. */
const PUA_LIMIT = 0xf900 - PUA_BASE;

/** codepoint → glyph id, consulted by the characterToGlyph hook below. */
const glyphOverrides = new Map<number, number>();

type PdfFontMetadata = {
  characterToGlyph: (character: number) => number;
  toUnicode?: Record<number, number>;
  [key: string]: unknown;
};

/** Make jsPDF consult our (shaped) glyph overrides. jsPDF 4 pre-filters every
 *  character through the font's raw `cmap.unicode.codeMap` (dropping unknowns)
 *  and then maps survivors via `characterToGlyph`, so both lookups must be
 *  intercepted. The TTFFont metadata exists from addFont() time. */
function ensureShapeHook(
  doc: jsPDF,
  family: ShaperFamily,
  style: ShaperStyle
): PdfFontMetadata | null {
  const font = (doc.getFont as unknown as (f: string, s: string) => { metadata?: PdfFontMetadata })(
    family,
    style
  );
  const md = font?.metadata;
  if (!md) return null;
  if (!md.__shapeHooked) {
    const cmapUnicode = (md as unknown as {
      cmap?: { unicode?: { codeMap?: Record<number, number> } };
    }).cmap?.unicode;
    if (!cmapUnicode?.codeMap) return null;
    cmapUnicode.codeMap = new Proxy(cmapUnicode.codeMap, {
      get(target, prop, receiver) {
        if (typeof prop === "string" || typeof prop === "number") {
          const gid = glyphOverrides.get(Number(prop));
          if (gid !== undefined) return gid;
        }
        return Reflect.get(target, prop, receiver);
      },
    });
    const original = md.characterToGlyph.bind(md);
    md.characterToGlyph = (character: number) =>
      glyphOverrides.get(character) ?? original(character);
    md.__shapeHooked = true;
  }
  return md;
}

interface ShapedPiece {
  font: ShaperFont;
  /** Substring that was shaped (for glyph → Unicode recovery). */
  source: string;
  glyphs: ShapedGlyph[];
}

interface ShapedWord {
  text: string;
  pieces: ShapedPiece[];
}

type ShapedItem = { kind: "word"; word: ShapedWord } | { kind: "space"; bengali: boolean };

/** Word → shaped pieces, cached across questions/PDFs. */
const wordCache = new Map<string, ShapedWord>();

function shapeWord(text: string, shaper: Shaper, style: ShaperStyle): ShapedWord {
  const cacheKey = `${style}|${text}`;
  const cached = wordCache.get(cacheKey);
  if (cached) return cached;

  const pieces: ShapedPiece[] = [];
  // Split into Bengali / other runs so each run is shaped with a font that
  // covers it (Hind Siliguri for Bengali, DejaVu Sans for Latin/math).
  let runStart = 0;
  let runIsBengali = isBengaliChar(text[0]);
  const pushRun = (from: number, to: number, bengali: boolean) => {
    if (to <= from) return;
    const source = text.slice(from, to);
    const font = shaper.font(bengali ? "HindSiliguri" : "DejaVuSans", style);
    if (!font) return;
    pieces.push({ font, source, glyphs: font.shape(source) });
  };
  for (let i = 1; i <= text.length; i++) {
    const bn = i < text.length ? isBengaliChar(text[i]) : !runIsBengali;
    if (i === text.length || bn !== runIsBengali) {
      pushRun(runStart, i, runIsBengali);
      runStart = i;
      runIsBengali = bn;
    }
  }

  const word: ShapedWord = { text, pieces };
  if (wordCache.size > 8000) wordCache.clear();
  wordCache.set(cacheKey, word);
  return word;
}

function shapeParagraph(text: string, shaper: Shaper, style: ShaperStyle): ShapedItem[] {
  const items: ShapedItem[] = [];
  let lastBengaliWord = false;
  for (const part of text.split(/(\s+)/)) {
    if (!part) continue;
    if (/^\s+$/.test(part)) {
      items.push({ kind: "space", bengali: lastBengaliWord });
    } else {
      items.push({ kind: "word", word: shapeWord(part, shaper, style) });
      lastBengaliWord = hasBengali(part);
    }
  }
  return items;
}

function pieceWidthMm(piece: ShapedPiece, sizePt: number): number {
  let units = 0;
  for (const g of piece.glyphs) units += g.ax;
  return (units * sizePt * PT_TO_MM) / piece.font.upem;
}

function wordWidthMm(word: ShapedWord, sizePt: number): number {
  let w = 0;
  for (const p of word.pieces) w += pieceWidthMm(p, sizePt);
  return w;
}

const spaceWidthCache = new Map<string, number>();
function spaceWidthMm(shaper: Shaper, style: ShaperStyle, bengali: boolean, sizePt: number): number {
  const key = `${style}|${bengali}`;
  let unitsPerEm = spaceWidthCache.get(key);
  if (unitsPerEm === undefined) {
    const font = shaper.font(bengali ? "HindSiliguri" : "DejaVuSans", style);
    const shaped = font ? font.shape(" ") : [];
    unitsPerEm = font
      ? shaped.reduce((acc, g) => acc + g.ax, 0) / font.upem
      : 0.25; // em fraction fallback
    spaceWidthCache.set(key, unitsPerEm);
  }
  return unitsPerEm * sizePt * PT_TO_MM;
}

/** Break overlong words at grapheme-cluster boundaries (safe for Bengali). */
function splitByGraphemes(text: string): string[] {
  const Seg = (Intl as unknown as { Segmenter?: new (
    locale?: string,
    opts?: { granularity: "grapheme" }
  ) => { segment(input: string): Iterable<{ segment: string }> } }).Segmenter;
  if (Seg) {
    const seg = new Seg(undefined, { granularity: "grapheme" });
    return Array.from(seg.segment(text), (s) => s.segment);
  }
  return Array.from(text);
}

/** Greedy word wrap over shaped items. Returns arrays of items per line. */
function layoutShapedItems(
  items: ShapedItem[],
  maxWidthMm: number,
  sizePt: number,
  style: ShaperStyle,
  shaper: Shaper
): ShapedItem[][] {
  const lines: ShapedItem[][] = [];
  let line: ShapedItem[] = [];
  let lineW = 0;

  const pushItem = (item: ShapedItem, w: number) => {
    line.push(item);
    lineW += w;
  };
  const newLine = () => {
    if (line.length) lines.push(line);
    line = [];
    lineW = 0;
  };

  let pendingSpace = false;
  for (const item of items) {
    if (item.kind === "space") {
      if (line.length) pendingSpace = true;
      continue;
    }
    const wordW = wordWidthMm(item.word, sizePt);

    if (wordW > maxWidthMm) {
      // A single word wider than the column: put it on a fresh line and break
      // it at grapheme-cluster boundaries (always safe for Bengali).
      const chunks = splitByGraphemes(item.word.text);
      if (chunks.length > 1) {
        newLine();
        pendingSpace = false;
        let acc: ShapedItem[] = [];
        let accW = 0;
        for (const chunk of chunks) {
          const chunkWord = shapeWord(chunk, shaper, style);
          const cw = wordWidthMm(chunkWord, sizePt);
          if (accW + cw > maxWidthMm && acc.length) {
            lines.push(acc);
            acc = [];
            accW = 0;
          }
          acc.push({ kind: "word", word: chunkWord });
          accW += cw;
        }
        if (acc.length) {
          line = acc;
          lineW = accW;
        }
        continue;
      }
    }

    const spaceW = pendingSpace
      ? spaceWidthMm(shaper, style, item.word.pieces[0]?.font.family === "HindSiliguri", sizePt)
      : 0;
    if (line.length && lineW + spaceW + wordW > maxWidthMm) {
      newLine();
      pendingSpace = false;
    }
    if (pendingSpace && line.length) {
      pushItem({ kind: "space", bengali: item.word.pieces[0]?.font.family === "HindSiliguri" }, spaceW);
      pendingSpace = false;
    }
    pushItem(item, wordW);
  }
  newLine();
  return lines;
}

/** Draw one shaped piece; returns the x where the pen stopped (mm). */
function drawShapedPiece(
  doc: jsPDF,
  piece: ShapedPiece,
  xMm: number,
  yBaselineMm: number,
  sizePt: number
): number {
  const k = (sizePt * PT_TO_MM) / piece.font.upem;
  doc.setFont(piece.font.family, piece.font.style);
  doc.setFontSize(sizePt);
  const md = ensureShapeHook(doc, piece.font.family, piece.font.style);

  let pen = xMm;
  let batch: ShapedGlyph[] = [];
  let batchStartX = pen;

  const rememberUnicode = (glyphs: ShapedGlyph[]) => {
    if (!md?.toUnicode) return;
    for (const g of glyphs) {
      md.toUnicode[g.gid] = piece.source.charCodeAt(Math.min(g.cluster, piece.source.length - 1));
    }
  };

  const flushBatch = () => {
    if (!batch.length) return;
    glyphOverrides.clear();
    let str = "";
    for (const g of batch) {
      if (g.gid >= PUA_LIMIT) continue; // cannot address — skip drawing
      glyphOverrides.set(PUA_BASE + g.gid, g.gid);
      str += String.fromCharCode(PUA_BASE + g.gid);
    }
    if (str) doc.text(str, batchStartX, yBaselineMm);
    rememberUnicode(batch);
    batch = [];
  };

  for (const g of piece.glyphs) {
    const gx = pen + g.dx * k;
    const gy = yBaselineMm - g.dy * k;
    if (g.gid === 0) {
      // Glyph missing in this font: still account for its advance.
      flushBatch();
      pen += g.ax * k;
      batchStartX = pen;
      continue;
    }
    if (g.dx === 0 && g.dy === 0 && g.gid < PUA_LIMIT) {
      if (!batch.length) batchStartX = pen;
      batch.push(g);
    } else {
      flushBatch();
      if (g.gid < PUA_LIMIT) {
        glyphOverrides.clear();
        glyphOverrides.set(PUA_BASE + g.gid, g.gid);
        doc.text(String.fromCharCode(PUA_BASE + g.gid), gx, gy);
        rememberUnicode([g]);
      }
    }
    pen += g.ax * k;
  }
  flushBatch();
  glyphOverrides.clear();
  return pen;
}

function drawShapedItems(
  doc: jsPDF,
  items: ShapedItem[],
  xMm: number,
  yBaselineMm: number,
  sizePt: number,
  style: ShaperStyle,
  shaper: Shaper
): void {
  let pen = xMm;
  for (const item of items) {
    if (item.kind === "space") {
      pen += spaceWidthMm(shaper, style, item.bengali, sizePt);
      continue;
    }
    for (const piece of item.word.pieces) {
      pen = drawShapedPiece(doc, piece, pen, yBaselineMm, sizePt);
    }
  }
}

/* ------------------------------------------------------------------ */

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

export async function buildExamQuestionsPdf(info: PdfExamInfo): Promise<jsPDF> {
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

  // Bengali (and any mixed Bengali/English) text needs real OpenType shaping,
  // which jsPDF cannot do — bring in HarfBuzz when the content needs it.
  const needsShaper =
    hasBengali(info.examTitle) ||
    hasBengali(info.subject) ||
    info.questions.some(
      (q) => hasBengali(q.prompt) || q.options.some((o) => hasBengali(o.text))
    );
  const shaper = needsShaper ? await loadShaper() : null;

  let y = MARGIN;

  const footer = () => {
    const total = doc.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      doc.setPage(p);
      doc.setFont("DejaVuSans", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(140, 132, 115);
      const brand = `World of Physics · ${info.examTitle}`;
      if (shaper && hasBengali(brand)) {
        drawShapedItems(
          doc,
          shapeParagraph(brand, shaper, "normal"),
          MARGIN,
          PAGE.h - 8,
          8.5,
          "normal",
          shaper
        );
      } else {
        doc.setFont(pickFamily(brand), "normal");
        doc.text(brand, MARGIN, PAGE.h - 8);
      }
      const label = `Page ${p} of ${total}`;
      doc.setFont("DejaVuSans", "normal");
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
    const style: ShaperStyle = opts.bold ? "bold" : "normal";
    const bn = hasBengali(text);
    doc.setTextColor(...(opts.color ?? [20, 17, 13]));

    if (shaper && bn) {
      const lines = layoutShapedItems(
        shapeParagraph(text, shaper, style),
        CONTENT_W - indent,
        size,
        style,
        shaper
      );
      const lineH = size * 0.48;
      for (const line of lines) {
        ensureSpace(lineH);
        drawShapedItems(doc, line, MARGIN + indent, y, size, style, shaper);
        y += lineH;
      }
      y += gap;
      doc.setTextColor(20, 17, 13);
      doc.setFont("DejaVuSans", "normal");
      return;
    }

    doc.setFont(pickFamily(text), style);
    doc.setFontSize(size);
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
  doc.setFont("DejaVuSans", "normal");
  doc.setFontSize(9);
  doc.setTextColor(140, 132, 115);
  doc.text("— End of question paper —", PAGE.w / 2, Math.min(y + 4, BOTTOM), {
    align: "center",
  });
  doc.setTextColor(20, 17, 13);

  footer();

  return doc;
}

export async function downloadExamQuestionsPdf(info: PdfExamInfo): Promise<void> {
  const doc = await buildExamQuestionsPdf(info);
  doc.save(`${(info.code || "exam").replace(/[^\w-]+/g, "_")}-question-paper.pdf`);
}
