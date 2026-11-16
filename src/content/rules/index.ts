// Pure rules derived from data, shared by sim and UI previews (architecture.md 6.9).
// LP writes, GD reviews. UI uses these only for previews; the values that count come from WorldView.

/**
 * Highest synergy threshold reached by `count` (K3). thresholds in any order; returns 0 when none.
 * Example: synergyTierFor(5, [2, 4, 6]) = 4.
 */
export function synergyTierFor(count: number, thresholds: readonly number[]): number {
  let best = 0;
  for (const t of thresholds) if (t <= count && t > best) best = t;
  return best;
}

/** Round half up (GDD 4.3: `round` = half up), safe for negative zero. */
export function roundHalfUp(v: number): number {
  return Math.floor(v + 0.5);
}

/**
 * Shop price (GDD 4.3): round(basePrice x (1 + priceGrowth x (t - 1)) x crackMult x mementoMult).
 * t = threat of the Pulse just cleared. All factors come from data (config price_growth,
 * rarity *_price, difficulty price_mult, shop_mod price_mult).
 */
export function priceFor(
  basePrice: number,
  threat: number,
  priceGrowth: number,
  crackMult: number,
  mementoMult: number,
): number {
  return roundHalfUp(basePrice * (1 + priceGrowth * (threat - 1)) * crackMult * mementoMult);
}

// TODO(LP with GD, M1-02): rerollPriceFor(t, n, delta) once GDD 4.4 fixes the reroll formula
// (shop.csv reroll_base_add, reroll_t_div, reroll_step).
