import { describe, expect, it } from 'vitest';
import { simFixtureData } from './support/sim-fixture.ts';

describe('sim fixture data', () => {
  it('builds with the real pipeline and has the run profiles', () => {
    const data = simFixtureData();
    expect(data.profiles['run_a']?.length).toBe(10);
    expect(data.profiles['run_a_m1']?.length).toBe(10);
    expect(data.mementos.length).toBe(12);
  });
});
