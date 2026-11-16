// Data id (snake_case, GD) to sprite id (kebab-case, AD) mapping (architecture.md 7.6, art-pipeline 2).
// swarmer -> unlit-swarmer, warden_hound -> warden-hound, boss_lantern -> boss-lantern, class lantern -> kept-lantern.
// TODO(LP + AD, M1-05): coverage test over GameData once enemies.csv and classes.csv exist.

const kebab = (id: string): string => id.replaceAll('_', '-');

export function spriteIdForClass(classId: string): string {
  return `kept-${kebab(classId)}`;
}

export function spriteIdForEnemy(enemyId: string): string {
  if (enemyId.startsWith('warden_') || enemyId.startsWith('boss_')) return kebab(enemyId);
  return `unlit-${kebab(enemyId)}`;
}
