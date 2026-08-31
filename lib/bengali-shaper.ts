/*
 * HarfBuzz-backed text shaping for the question-paper PDF.
 *
 * jsPDF draws custom-font text purely through each font's `cmap`: one glyph
 * per Unicode character, laid out in logical order. That is fine for Latin,
 * but Bengali is a complex script — conjuncts (প্র, শ্র, ক্ষ …), pre-base
 * vowel signs (ি, ে, ৈ) that must be drawn BEFORE their consonant, reph (র্ক),
 * and marks that attach above/below the base all require OpenType GSUB/GPOS
 * processing, which jsPDF does not do. The embedded Hind Siliguri font ships
 * full Bengali shaping tables; they were simply never applied.
 *
 * This module loads HarfBuzz (the same shaper used by browsers, Linux and
 * Android) compiled to WebAssembly, shapes strings into positioned glyph
 * runs (glyph ids + advances/offsets in font units), and hands those to
 * jsPDF — which conveniently writes raw glyph ids for embedded TTF fonts
 * (Identity-H encoding with /CIDToGIDMap /Identity).
 */

import createHarfBuzz, { type HarfBuzzModule } from "./hb/harfbuzz-glue.js";
import { DEJAVU_SANS_REGULAR_B64 } from "./fonts/dejavu-sans";
import { DEJAVU_SANS_BOLD_B64 } from "./fonts/dejavu-sans-bold";
import { HIND_SILIGURI_REGULAR_B64 } from "./fonts/hind-siliguri-reg";
import { HIND_SILIGURI_BOLD_B64 } from "./fonts/hind-siliguri-bold";

export type ShaperFamily = "HindSiliguri" | "DejaVuSans";
export type ShaperStyle = "normal" | "bold";

/** One positioned glyph, in font units (scale = unitsPerEm). */
export interface ShapedGlyph {
  /** Glyph id in the font (what jsPDF writes as its character code). */
  gid: number;
  /** Index (UTF-16 code units) into the source string this glyph came from. */
  cluster: number;
  /** Horizontal advance. */
  ax: number;
  /** Horizontal placement offset (e.g. marks). */
  dx: number;
  /** Vertical placement offset, positive = up (e.g. marks). */
  dy: number;
}

export interface ShaperFont {
  family: ShaperFamily;
  style: ShaperStyle;
  upem: number;
  /** Shape `text` (no line breaks) into positioned glyphs. */
  shape(text: string): ShapedGlyph[];
}

export interface Shaper {
  font(family: ShaperFamily, style: ShaperStyle): ShaperFont;
}

/* ------------------------------------------------------------------ */

let shaperPromise: Promise<Shaper | null> | null = null;

/** Overridable wasm source; the app uses /hb.wasm from ./public. */
let wasmSource: () => Promise<Uint8Array> = async () => {
  const res = await fetch("/hb.wasm");
  if (!res.ok) throw new Error(`hb.wasm request failed: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
};

/** @internal Test seam: point the shaper at a local copy of hb.wasm. */
export function setShaperWasmSource(loader: () => Promise<Uint8Array>): void {
  wasmSource = loader;
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof atob === "function") {
    const raw = atob(b64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
  }
  // Node (tests): atob exists in Node 16+, this is just belt and braces.
  return new Uint8Array(Buffer.from(b64, "base64"));
}

const HB_MEMORY_MODE_WRITABLE = 2;

function createShaperFont(
  hb: HarfBuzzModule,
  exports: Record<string, (...args: number[]) => number>,
  bytes: Uint8Array,
  family: ShaperFamily,
  style: ShaperStyle
): ShaperFont {
  // Copy the font bytes into wasm memory once and keep them alive for the
  // lifetime of the page (HarfBuzz does not own them with mode=WRITABLE and
  // a null destroy callback — no free, by design).
  const dataPtr = exports.malloc(bytes.length);
  hb.HEAPU8.set(bytes, dataPtr);
  const blob = exports.hb_blob_create(dataPtr, bytes.length, HB_MEMORY_MODE_WRITABLE, 0, 0);
  const face = exports.hb_face_create(blob, 0);
  const upem = exports.hb_face_get_upem(face);
  const font = exports.hb_font_create(face);
  // Default HarfBuzz scale already equals unitsPerEm (positions in font
  // units); set it explicitly so the contract is not accidental.
  exports.hb_font_set_scale(font, upem, upem);

  return {
    family,
    style,
    upem,
    shape(text: string): ShapedGlyph[] {
      if (!text) return [];
      const units: number[] = [];
      for (let i = 0; i < text.length; i++) units.push(text.charCodeAt(i));
      const textPtr = exports.malloc(units.length * 2);
      if (textPtr & 1) throw new Error("unaligned malloc for shaped text");
      hb.HEAPU16.set(units, textPtr >> 1);
      const buffer = exports.hb_buffer_create();
      try {
        exports.hb_buffer_add_utf16(buffer, textPtr, units.length, 0, units.length);
        exports.hb_buffer_guess_segment_properties(buffer);
        exports.hb_shape(font, buffer, 0, 0);
        const len = exports.hb_buffer_get_length(buffer);
        const infos = exports.hb_buffer_get_glyph_infos(buffer, 0);
        const poss = exports.hb_buffer_get_glyph_positions(buffer, 0);
        const infos32 = infos >> 2;
        const poss32 = poss >> 2;
        const out: ShapedGlyph[] = [];
        for (let i = 0; i < len; i++) {
          // hb_glyph_info_t: {codepoint, mask, cluster, var1, var2}
          // hb_glyph_position_t: {x_advance, y_advance, x_offset, y_offset, var}
          out.push({
            gid: hb.HEAPU32[infos32 + i * 5],
            cluster: hb.HEAPU32[infos32 + i * 5 + 2],
            ax: hb.HEAP32[poss32 + i * 5],
            dx: hb.HEAP32[poss32 + i * 5 + 2],
            dy: hb.HEAP32[poss32 + i * 5 + 3],
          });
        }
        return out;
      } finally {
        exports.hb_buffer_destroy(buffer);
        exports.free(textPtr);
      }
    },
  };
}

/**
 * Lazily initialize HarfBuzz and wrap the four embedded PDF fonts as shapers.
 * Resolves to `null` (and warns once) if the wasm or fonts cannot be loaded —
 * callers should fall back to jsPDF's plain text drawing in that case.
 */
export function loadShaper(): Promise<Shaper | null> {
  shaperPromise ??= (async () => {
    try {
  const hbModule = await createHarfBuzz({ wasmBinary: await wasmSource() });
  if (!hbModule) throw new Error("HarfBuzz module failed to initialize");
  const exports = hbModule.wasmExports as unknown as Record<
    string,
    (...args: number[]) => number
  >;
  const fonts: Record<string, ShaperFont> = {
    "HindSiliguri|normal": createShaperFont(
      hbModule,
      exports,
          base64ToBytes(HIND_SILIGURI_REGULAR_B64),
          "HindSiliguri",
          "normal"
        ),
        "HindSiliguri|bold": createShaperFont(
          hbModule,
          exports,
          base64ToBytes(HIND_SILIGURI_BOLD_B64),
          "HindSiliguri",
          "bold"
        ),
        "DejaVuSans|normal": createShaperFont(
          hbModule,
          exports,
          base64ToBytes(DEJAVU_SANS_REGULAR_B64),
          "DejaVuSans",
          "normal"
        ),
        "DejaVuSans|bold": createShaperFont(
          hbModule,
          exports,
          base64ToBytes(DEJAVU_SANS_BOLD_B64),
          "DejaVuSans",
          "bold"
        ),
      };
      return {
        font(family: ShaperFamily, style: ShaperStyle): ShaperFont {
          return fonts[`${family}|${style}`];
        },
      };
    } catch (err) {
      console.warn(
        "[exam-pdf] Bengali shaper unavailable — PDF text will be written unshaped.",
        err
      );
      // Allow a later retry (e.g. transient network failure on first click).
      shaperPromise = null;
      return null;
    }
  })();
  return shaperPromise;
}
