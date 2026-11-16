// Minimal fake of the Web Audio API for AudioSystem and MusicPlayer tests in Node. Records the
// calls the tests assert on (automation, started sources, closed context); renders no sound.

export interface ParamCall {
  readonly kind: 'set' | 'linear' | 'exp' | 'target' | 'cancel';
  readonly value: number;
  readonly time: number;
}

export class FakeParam {
  value: number;
  readonly calls: ParamCall[] = [];
  constructor(v = 1) {
    this.value = v;
  }
  setValueAtTime(value: number, time: number): this {
    this.calls.push({ kind: 'set', value, time });
    this.value = value;
    return this;
  }
  linearRampToValueAtTime(value: number, time: number): this {
    this.calls.push({ kind: 'linear', value, time });
    return this;
  }
  exponentialRampToValueAtTime(value: number, time: number): this {
    this.calls.push({ kind: 'exp', value, time });
    return this;
  }
  setTargetAtTime(value: number, time: number, _tau: number): this {
    this.calls.push({ kind: 'target', value, time });
    return this;
  }
  cancelScheduledValues(time: number): this {
    this.calls.push({ kind: 'cancel', value: 0, time });
    return this;
  }
}

class FakeNode {
  connect<T>(n: T): T {
    return n;
  }
  disconnect(): void {
    // Nothing to tear down.
  }
}

export class FakeGain extends FakeNode {
  readonly gain = new FakeParam(1);
}

class FakeBiquad extends FakeNode {
  type = 'lowpass';
  readonly frequency = new FakeParam(350);
}

class FakeCompressor extends FakeNode {
  readonly threshold = new FakeParam(0);
  readonly ratio = new FakeParam(1);
  readonly knee = new FakeParam(0);
  readonly attack = new FakeParam(0);
  readonly release = new FakeParam(0);
}

class FakeConvolver extends FakeNode {
  normalize = true;
  buffer: FakeBuffer | null = null;
}

class FakePanner extends FakeNode {
  readonly pan = new FakeParam(0);
}

export class FakeBuffer {
  readonly length: number;
  readonly sampleRate: number;
  readonly duration: number;
  private readonly channels: Float32Array[];
  constructor(ch: number, length: number, sampleRate: number) {
    this.length = length;
    this.sampleRate = sampleRate;
    this.duration = length / sampleRate;
    this.channels = Array.from({ length: ch }, () => new Float32Array(length));
  }
  getChannelData(i: number): Float32Array {
    const c = this.channels[i];
    if (c === undefined) throw new Error('channel');
    return c;
  }
}

export class FakeSource extends FakeNode {
  buffer: FakeBuffer | null = null;
  readonly playbackRate = new FakeParam(1);
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  startedAt = Number.NaN;
  stoppedAt = Number.NaN;
  onended: (() => void) | null = null;
  private readonly ctx: FakeAudioContext;
  constructor(ctx: FakeAudioContext) {
    super();
    this.ctx = ctx;
  }
  start(when = 0): void {
    this.startedAt = when;
    this.ctx.started.push(this);
  }
  stop(when = 0): void {
    this.stoppedAt = when;
  }
}

export class FakeAudioContext {
  currentTime = 0;
  readonly sampleRate = 48000;
  state: 'running' | 'suspended' | 'closed';
  readonly destination = { channelCount: 2 };
  readonly started: FakeSource[] = [];
  readonly gains: FakeGain[] = [];
  closed = false;
  /** When set, resume() waits for this promise (dispose-during-boot tests). */
  resumeGate: Promise<void> | null = null;

  constructor(state: 'running' | 'suspended' = 'running') {
    this.state = state;
  }
  createGain(): FakeGain {
    const g = new FakeGain();
    this.gains.push(g);
    return g;
  }
  createBiquadFilter(): FakeBiquad {
    return new FakeBiquad();
  }
  createDynamicsCompressor(): FakeCompressor {
    return new FakeCompressor();
  }
  createConvolver(): FakeConvolver {
    return new FakeConvolver();
  }
  createStereoPanner(): FakePanner {
    return new FakePanner();
  }
  createBuffer(ch: number, length: number, sampleRate: number): FakeBuffer {
    return new FakeBuffer(ch, length, sampleRate);
  }
  createBufferSource(): FakeSource {
    return new FakeSource(this);
  }
  async resume(): Promise<void> {
    if (this.resumeGate !== null) await this.resumeGate;
    this.state = 'running';
  }
  async suspend(): Promise<void> {
    this.state = 'suspended';
    return Promise.resolve();
  }
  async close(): Promise<void> {
    this.closed = true;
    this.state = 'closed';
    return Promise.resolve();
  }
  /** The fake as the DOM type the audio code expects. */
  asContext(): AudioContext {
    return this as unknown as AudioContext;
  }
}
