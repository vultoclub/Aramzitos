export function xpNeeded(level) { return level * 200; }

// Cargos por nivel â€” IDs configurados nas env vars da Vercel
// ROLE_LEVEL_5, ROLE_LEVEL_10, ROLE_LEVEL_20
export const LEVEL_ROLES = [
  { level: 5,  envKey: "ROLE_LEVEL_5",  name: "Carteiro do ARAM" },
  { level: 10, envKey: "ROLE_LEVEL_10", name: "Mestre das Cartas" },
  { level: 20, envKey: "ROLE_LEVEL_20", name: "Lenda das Cartas" },
];

export function applyMatchReward(player, won) {
  let xp    = Number(player.xp ?? 0) + (won ? 100 : 40);
  let level = Number(player.level ?? 1);
  const oldLevel = level;

  while (xp >= xpNeeded(level)) {
    xp -= xpNeeded(level);
    level += 1;
  }

  return {
    xp,
    level,
    oldLevel,
    leveledUp: level > oldLevel,
    coins: Number(player.coins ?? 0) + (won ? 50 : 15),
    matches_played: Number(player.matches_played ?? 0) + 1,
    matches_won: Number(player.matches_won ?? 0) + (won ? 1 : 0),
  };
}

// Devolve os roleIds que devem ser atribuidos para este nivel
export function getRolesForLevel(level) {
  return LEVEL_ROLES
    .filter(r => level >= r.level)
    .map(r => ({ ...r, roleId: process.env[r.envKey] }))
    .filter(r => r.roleId);
}
