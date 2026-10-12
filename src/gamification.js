export function xpNeeded(level) { return level * 200; }

export function applyMatchReward(player, won) {
  let xp = Number(player.xp ?? 0) + (won ? 100 : 40);
  let level = Number(player.level ?? 1);
  while (xp >= xpNeeded(level)) {
    xp -= xpNeeded(level);
    level += 1;
  }
  return {
    xp,
    level,
    coins: Number(player.coins ?? 0) + (won ? 50 : 15),
    matches_played: Number(player.matches_played ?? 0) + 1,
    matches_won: Number(player.matches_won ?? 0) + (won ? 1 : 0),
  };
}
