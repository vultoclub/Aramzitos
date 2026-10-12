const ACCOUNT_REGION = "americas";
const PLATFORM_REGION = "americas";

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
