// Packed source references for hits, telegraphs, projectiles, events (architecture.md 6.1). [Frozen M1]

/** Who caused a hit, telegraph, or projectile. Packed into one int for SoA columns and event payloads. */
export const SourceKind = {
  None: 0,
  Weapon: 1,
  Rite: 2,
  Effect: 3,
  Status: 4,
  EnemyContact: 5,
  EnemyAttack: 6,
  BossPattern: 7,
  Affix: 8,
  Spawn: 9,
} as const;
export type SourceKind = (typeof SourceKind)[keyof typeof SourceKind];

const SOURCE_STRIDE = 65536;

/** index is the dense index in the table matching kind (WeaponIndex, RiteIndex, EffectIndex, ...). */
export function encodeSource(kind: SourceKind, index: number): number {
  return kind * SOURCE_STRIDE + index;
}

export function sourceKindOf(ref: number): SourceKind {
  return Math.floor(ref / SOURCE_STRIDE) as SourceKind;
}

export function sourceIndexOf(ref: number): number {
  return ref % SOURCE_STRIDE;
}

/** Attack shape of a hit, mirrors source_kind in effect-primitives 4. */
export const HitKind = {
  Projectile: 0,
  Melee: 1,
  Area: 2,
  Chain: 3,
  Contact: 4,
  Zone: 5,
  Dot: 6,
} as const;
export type HitKind = (typeof HitKind)[keyof typeof HitKind];
