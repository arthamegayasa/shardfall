// Pure DSP for SFX and music (AU; architecture.md 11): no Web Audio here, so it runs in Node tests
// and in tools/audio. Everything is deterministic: the RNG is seeded from the recipe id.

export {
  createBiquad,
  createNoise,
  fadeEdges,
  filterInPlace,
  normalizePeak,
  peakOf,
  waveSample,
} from './dsp.ts';
export type { Biquad, FilterType, NoiseSource, Wave } from './dsp.ts';
export { renderLayers } from './layers.ts';
export type {
  FilterSpec,
  GrainsLayer,
  LayerBase,
  LayerSpec,
  NoiseLayer,
  PluckLayer,
  RepeatSpec,
  ToneLayer,
} from './layers.ts';
export {
  dbToGain,
  freqOf,
  isNoteName,
  midiToHz,
  noteToMidi,
  semisToRatio,
} from './notes.ts';
export { loopPointsOf, pickRef, renderCue, renderInstrumentSample, seedFor } from './render.ts';
export type { InstrumentDef, SynthRecipe } from './render.ts';
export { IR_HALL, IR_ROOM, renderIr } from './ir.ts';
export type { IrSpec } from './ir.ts';
export { mixNote, panGains } from './mix.ts';
export type { MixNote } from './mix.ts';
