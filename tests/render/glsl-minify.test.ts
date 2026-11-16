// GLSL template minifier used by the production build (LP, M2-02).

import { describe, expect, it } from 'vitest';
import { minifyGlslChunk, minifyGlslTemplates } from '../../tools/build/glsl-minify.ts';

describe('minifyGlslTemplates', () => {
  it('strips comments, indentation, and blank lines but keeps newlines', () => {
    const src =
      'export const A = /* glsl */ `\n  // note\n  #define X 1\n\n  float f() {   return 1.0; } // tail\n`;';
    expect(minifyGlslTemplates(src)).toBe(
      'export const A = /* glsl */ `\n#define X 1\nfloat f() { return 1.0; }\n`;',
    );
  });

  it('leaves template expressions untouched', () => {
    const src = 'const B = /* glsl */ `\n  ${CHUNK}\n  float r = w * ${f(2)};\n`;';
    expect(minifyGlslTemplates(src)).toBe(
      'const B = /* glsl */ `\n${CHUNK}\nfloat r = w * ${f(2)};\n`;',
    );
  });

  it('does not touch code outside glsl templates', () => {
    const src = 'const s = `  // keep me\n`; // and me';
    expect(minifyGlslTemplates(src)).toBe(src);
  });

  it('collapses runs of spaces inside a line', () => {
    expect(minifyGlslChunk('a  =   b;')).toBe('a = b;');
  });
});
