// Branded dense indices into GameData tables (architecture.md 6.1). [Frozen M1]

export type Brand<T, B extends string> = T & { readonly __brand: B };

/** Dense indices into GameData tables, assigned at load from string ids (CSV row order). */
export type EnemyTypeIndex = Brand<number, 'EnemyTypeIndex'>;
export type WeaponIndex = Brand<number, 'WeaponIndex'>;
export type MementoIndex = Brand<number, 'MementoIndex'>;
export type ClassIndex = Brand<number, 'ClassIndex'>;
export type RiteIndex = Brand<number, 'RiteIndex'>;
export type StatIndex = Brand<number, 'StatIndex'>;
export type TagIndex = Brand<number, 'TagIndex'>;
export type EffectIndex = Brand<number, 'EffectIndex'>;
export type AffixIndex = Brand<number, 'AffixIndex'>;
export type BossPatternIndex = Brand<number, 'BossPatternIndex'>;
export type StatusIndex = Brand<number, 'StatusIndex'>;
export type LevelUpCardIndex = Brand<number, 'LevelUpCardIndex'>;
