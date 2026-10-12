const ACCOUNT_REGION = "americas";
const PLATFORM_REGION = process.env.RIOT_PLATFORM_REGION || "br1";

async function riotGet(url) {
  const key = process.env.RIOT_API_KEY;
  if (!key) throw new Error("RIOT_API_KEY is not configured");
  const response = await fetch(url, { headers: { "X-Riot-Token": key } });
  if (!response.ok) {
    const error = new Error(`Riot API returned ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

export async function getAccountByRiotId(gameName, tagLine) {
  const path = `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
  return riotGet(`https://${ACCOUNT_REGION}.api.riotgames.com${path}`);
}

export async function getSummonerByPuuid(puuid) {
  const path = `/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(puuid)}`;
  return riotGet(`https://${PLATFORM_REGION}.api.riotgames.com${path}`);
}

export async function getSummonerRank(summonerId) {
  try {
    const path = `/lol/league/v4/entries/by-summoner/${encodeURIComponent(summonerId)}`;
    const entries = await riotGet(`https://${PLATFORM_REGION}.api.riotgames.com${path}`);
    // Prefere RANKED_SOLO_5x5, depois RANKED_FLEX_SR
    const solo = entries.find(e => e.queueType === "RANKED_SOLO_5x5");
    const flex = entries.find(e => e.queueType === "RANKED_FLEX_SR");
    const entry = solo || flex;
    if (!entry) return { tier: "UNRANKED", rank: "", lp: 0 };
    return { tier: entry.tier, rank: entry.rank, lp: entry.leaguePoints };
  } catch {
    return { tier: "UNRANKED", rank: "", lp: 0 };
  }
}

export function rankEmoji(tier) {
  const map = {
    IRON: "ðŸ©¶", BRONZE: "ðŸ¥‰", SILVER: "ðŸª™", GOLD: "ðŸ¥‡",
    PLATINUM: "ðŸ’ ", EMERALD: "ðŸ’š", DIAMOND: "ðŸ’Ž",
    MASTER: "ðŸ”®", GRANDMASTER: "ðŸ”¥", CHALLENGER: "ðŸ‘‘",
    UNRANKED: "â”",
  };
  return map[tier] ?? "â”";
}
