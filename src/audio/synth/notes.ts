// Note names and unit conversions for the pure DSP and the sequencer (audio-direction 5.3 notation).

const NOTE_INDEX: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const NOTE_RE = /^([A-G])(#|b)?(-?\d)$/;

/** Scientific pitch name ("C4" = 60, "C#5", "Bb4") to MIDI number. Throws on a malformed name. */
export function noteToMidi(name: string): number {
  const m = NOTE_RE.exec(name);
  if (m === null) throw new Error(`Bad note name "${name}"`);
  const base = NOTE_INDEX[m[1] ?? 'C'] ?? 0;
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return (Number(m[3]) + 1) * 12 + base + acc;
}

export function isNoteName(name: string): boolean {
  return NOTE_RE.test(name);
}

export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** A frequency field in data: Hz as a number or a note name. */
export function freqOf(v: number | string): number {
  return typeof v === 'number' ? v : midiToHz(noteToMidi(v));
}

export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

export function semisToRatio(semis: number): number {
  return Math.pow(2, semis / 12);
}
