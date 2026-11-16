// GLSL template minifier for the production build (LP, M2-02; architecture 13 bundle budget).
// Shader sources live as `/* glsl */` template literals in src/render/shaders/*.ts. This strips line
// comments, indentation, blank lines, and repeated spaces from the static parts of those templates.
// Newlines are kept (preprocessor lines need them) and `${...}` expressions are left untouched.

const MARK = '/* glsl */';

/** Minify one static chunk of GLSL text (no template expressions inside). */
export function minifyGlslChunk(text: string): string {
  return (
    text
      // Line comments that end inside this chunk (a comment never precedes `${` on our lines).
      .replace(/\/\/[^\n]*(?=\n)/g, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/ ?\n ?/g, '\n')
      .replace(/\n{2,}/g, '\n')
  );
}

/** Minify every `/* glsl *\/` template literal in a module's source. Returns the new source. */
export function minifyGlslTemplates(code: string): string {
  let out = '';
  let i = 0;
  for (;;) {
    const at = code.indexOf(MARK, i);
    if (at < 0) break;
    const tick = code.indexOf('`', at + MARK.length);
    if (tick < 0 || code.slice(at + MARK.length, tick).trim() !== '') {
      out += code.slice(i, at + MARK.length);
      i = at + MARK.length;
      continue;
    }
    out += code.slice(i, tick + 1);
    let j = tick + 1;
    let chunk = '';
    for (;;) {
      const c = code[j];
      if (c === undefined) throw new Error('glsl-minify: unterminated template literal');
      if (c === '\\') {
        chunk += c + (code[j + 1] ?? '');
        j += 2;
        continue;
      }
      if (c === '`') {
        out += minifyGlslChunk(chunk) + '`';
        j++;
        break;
      }
      if (c === '$' && code[j + 1] === '{') {
        out += minifyGlslChunk(chunk);
        chunk = '';
        // Copy the expression verbatim, matching braces.
        let depth = 0;
        let k = j + 1;
        for (; k < code.length; k++) {
          if (code[k] === '{') depth++;
          else if (code[k] === '}') {
            depth--;
            if (depth === 0) break;
          }
        }
        out += code.slice(j, k + 1);
        j = k + 1;
        continue;
      }
      chunk += c;
      j++;
    }
    i = j;
  }
  return out + code.slice(i);
}
