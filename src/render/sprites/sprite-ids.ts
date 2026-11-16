// Data id (snake_case, GD) to sprite id (kebab-case, AD) mapping (architecture.md 7.6, art-pipeline 2).
// swarmer -> unlit-swarmer, warden_hound -> warden-hound, boss_lantern -> boss-lantern, class lantern -> kept-lantern,
// weapon splinter_shot -> fx-shot-splinter-shot. Resolvers fall back to declared placeholders so a new data row
// never renders as nothing (coverage test: tests/render/sprite-ids.test.ts).

const kebab = (id: string): string => id.replaceAll('_', '-');

export function spriteIdForClass(classId: string): string {
  return `kept-${kebab(classId)}`;
}

export function spriteIdForEnemy(enemyId: string): string {
  if (enemyId.startsWith('warden_') || enemyId.startsWith('boss_')) return kebab(enemyId);
  return `unlit-${kebab(enemyId)}`;
}

export function spriteIdForWeapon(weaponId: string): string {
  return `fx-shot-${kebab(weaponId)}`;
}

/** Declared placeholders used when a data row has no sprite of its own. */
export const FALLBACK_SPRITES = {
  player: 'kept-lantern',
  playerShot: 'fx-shot-kept',
  enemyShot: 'fx-shot-danger',
  glint: 'fx-glint',
  burn: 'fx-burn',
  spawnCrack: 'fx-spawn-crack',
  digits: 'fx-digits',
  bySize: {
    small: 'unlit-swarmer',
    medium: 'unlit-charger',
    large: 'unlit-tank',
    warden: 'warden-hound',
    boss: 'boss-lantern',
  },
} as const;

export interface EnemySpriteKey {
  readonly id: string;
  readonly role: string;
  readonly behavior: string;
  readonly sizeClass: string;
}

/**
 * Sprite id for an enemy row: own id, then behavior (warden_hound archetype), then role (swarmer...),
 * then the size placeholder. `has` tells whether the atlas contains an id.
 */
export function resolveEnemySpriteId(row: EnemySpriteKey, has: (id: string) => boolean): string {
  const byId = spriteIdForEnemy(row.id);
  if (has(byId)) return byId;
  const byBehavior = spriteIdForEnemy(row.behavior);
  if (has(byBehavior)) return byBehavior;
  const byRole = spriteIdForEnemy(row.role);
  if (has(byRole)) return byRole;
  const sizes: Readonly<Record<string, string>> = FALLBACK_SPRITES.bySize;
  return sizes[row.sizeClass] ?? FALLBACK_SPRITES.bySize.medium;
}

export function resolveClassSpriteId(classId: string, has: (id: string) => boolean): string {
  const id = spriteIdForClass(classId);
  return has(id) ? id : FALLBACK_SPRITES.player;
}

export function resolveWeaponSpriteId(weaponId: string, has: (id: string) => boolean): string {
  const id = spriteIdForWeapon(weaponId);
  return has(id) ? id : FALLBACK_SPRITES.playerShot;
}
