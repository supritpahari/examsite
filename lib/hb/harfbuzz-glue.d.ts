/**
 * Type surface for the vendored Emscripten/HarfBuzz module factory in
 * `./harfbuzz-glue.js` (from harfbuzzjs 1.6.0). Only the pieces used by
 * `lib/bengali-shaper.ts` are declared here.
 */

export interface HarfBuzzWasmExports {
  malloc(size: number): number;
  free(ptr: number): void;
  /** C: hb_blob_create(data, length, mode, user_data, destroy) */
  hb_blob_create(
    data: number,
    length: number,
    mode: number,
    userData: number,
    destroy: number
  ): number;
  hb_face_create(blob: number, index: number): number;
  hb_face_get_upem(face: number): number;
  hb_font_create(face: number): number;
  hb_font_set_scale(font: number, xScale: number, yScale: number): void;
  hb_buffer_create(): number;
  hb_buffer_destroy(buffer: number): void;
  hb_buffer_add_utf16(
    buffer: number,
    text: number,
    textLength: number,
    itemOffset: number,
    itemLength: number
  ): void;
  hb_buffer_guess_segment_properties(buffer: number): void;
  hb_shape(font: number, buffer: number, features: number, numFeatures: number): void;
  hb_buffer_get_length(buffer: number): number;
  hb_buffer_get_glyph_infos(buffer: number, textLengthPtr: number): number;
  hb_buffer_get_glyph_positions(buffer: number, textLengthPtr: number): number;
  [key: string]: (...args: number[]) => number;
}

export interface HarfBuzzModule {
  wasmExports: HarfBuzzWasmExports;
  HEAPU8: Uint8Array;
  HEAPU16: Uint16Array;
  HEAP32: Int32Array;
  HEAPU32: Uint32Array;
}

export interface HarfBuzzModuleArg {
  /** Raw wasm bytes; skips the module's own wasm-file lookup. */
  wasmBinary?: Uint8Array | ArrayBuffer;
}

export default function createHarfBuzz(
  moduleArg?: HarfBuzzModuleArg
): Promise<HarfBuzzModule> | HarfBuzzModule;
