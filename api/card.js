import { getSupabase } from "../src/supabase.js";
import { getSummonerRank, rankEmoji } from "../src/riot.js";

const SKINS = {
  default: {
    bg: "linear-gradient(135deg, #0d0d1a 0%, #1a0a2e 50%, #0d0d1a 100%)",
    glow: "rgba(88,101,242,0.5)",
    accent: "#5865F2",
    accentDark: "#3a4abf",
  },
  shadow: {
    bg: "linear-gradient(135deg, #0a0000 0%, #2a0000 40%, #0a0000 100%)",
    glow: "rgba(200,0,0,0.5)",
    accent: "#cc0000",
    accentDark: "#880000",
    radial: "radial-gradient(ellipse at 80% 40%, rgba(200,0,0,0.45) 0%, transparent 55%)",
  },
  gold: {
    bg: "linear-gradient(135deg, #0d0900 0%, #2a1f00 40%, #0d0900 100%)",
    glow: "rgba(255,184,0,0.5)",
    accent: "#FFB800",
    accentDark: "#b37f00",
    radial: "radial-gradient(ellipse at 80% 40%, rgba(255,180,0,0.3) 0%, transparent 55%)",
  },
  void: {
    bg: "linear-gradient(135deg, #07000f 0%, #1a0033 40%, #07000f 100%)",
    glow: "rgba(140,0,255,0.5)",
    accent: "#8c00ff",
    accentDark: "#5c00aa",
    radial: "radial-gradient(ellipse at 80% 40%, rgba(140,0,255,0.35) 0%, transparent 55%)",
  },
  ice: {
    bg: "linear-gradient(135deg, #000d1a 0%, #001a33 40%, #000d1a 100%)",
    glow: "rgba(0,180,255,0.5)",
    accent: "#00b4ff",
    accentDark: "#007baa",
    radial: "radial-gradient(ellipse at 80% 40%, rgba(0,180,255,0.3) 0%, transparent 55%)",
  },
};

function xpNeeded(level) { return level * 200; }

function buildSvg(player, rank) {
  const skin = SKINS[player.active_skin] ?? SKINS.default;
  const { accent, accentDark, glow, bg, radial } = skin;
  const iconUrl = `https://ddragon.leagueoflegends.com/cdn/14.20.1/img/profileicon/${player.profile_icon_id ?? 1}.png`;
  const xpPct = Math.min(100, Math.round((player.xp / xpNeeded(player.level)) * 100));
  const winRate = player.matches_played ? Math.round((player.matches_won / player.matches_played) * 100) : 0;
  const tierLabel = rank.tier === "UNRANKED" ? "Unranked" : `${rank.tier[0]}${rank.tier.slice(1).toLowerCase()} ${rank.rank}`;
  const emoji = rankEmoji(rank.tier);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="220">
  <defs>
    <clipPath id="card"><rect width="520" height="220" rx="16"/></clipPath>
    <clipPath id="avatar"><circle cx="60" cy="90" r="38"/></clipPath>
    <linearGradient id="xpGrad" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0%" stop-color="${accent}"/>
      <stop offset="100%" stop-color="${accentDark}"/>
    </linearGradient>
  </defs>

  <g clip-path="url(#card)">
    <!-- Background -->
    <rect width="520" height="220" fill="${bg.includes('gradient') ? '#0d0d1a' : bg}"/>
    ${radial ? `<rect width="520" height="220" fill="url(#radialFill)"/>` : ""}
    <!-- Overlay -->
    <rect width="520" height="220" fill="url(#overlay)"/>

    <!-- Avatar circle bg -->
    <circle cx="60" cy="90" r="42" fill="${accent}" fill-opacity="0.15"/>
    <circle cx="60" cy="90" r="41" fill="none" stroke="${accent}" stroke-width="3"/>

    <!-- Avatar image placeholder (rendered server-side would use fetch) -->
    <circle cx="60" cy="90" r="38" fill="#1a1a2e"/>
    <text x="60" y="97" text-anchor="middle" font-size="28" fill="${accent}">â˜…</text>

    <!-- Elo badge -->
    <text x="60" y="155" text-anchor="middle" font-size="18">${emoji}</text>
    <text x="60" y="172" text-anchor="middle" font-size="10" font-family="Arial" font-weight="700" fill="${accent}" letter-spacing="0.5">${tierLabel}</text>

    <!-- Username -->
    <text x="120" y="56" font-family="Arial" font-size="18" font-weight="700" fill="white">${escXml(player.riot_id.split("#")[0])}</text>
    <text x="${120 + player.riot_id.split("#")[0].length * 10 + 4}" y="56" font-family="Arial" font-size="18" fill="rgba(255,255,255,0.35)">#${escXml(player.riot_id.split("#")[1] ?? "")}</text>

    <!-- Verified badge -->
    <rect x="120" y="62" width="68" height="16" rx="8" fill="${accent}"/>
    <text x="154" y="74" text-anchor="middle" font-family="Arial" font-size="10" font-weight="700" fill="white">Verificado</text>

    <!-- Divider -->
    <rect x="120" y="84" width="370" height="1" fill="${accent}" fill-opacity="0.25"/>

    <!-- XP bar label -->
    <text x="120" y="99" font-family="Arial" font-size="11" fill="rgba(255,255,255,0.55)">Nivel ${player.level}</text>
    <text x="490" y="99" text-anchor="end" font-family="Arial" font-size="11" fill="${accent}">${player.xp} / ${xpNeeded(player.level)} XP</text>

    <!-- XP bar -->
    <rect x="120" y="104" width="370" height="6" rx="3" fill="rgba(255,255,255,0.08)"/>
    <rect x="120" y="104" width="${Math.round(370 * xpPct / 100)}" height="6" rx="3" fill="url(#xpGrad)"/>

    <!-- Stats -->
    <text x="120" y="134" font-family="Arial" font-size="10" fill="rgba(255,255,255,0.45)" letter-spacing="0.8">MOEDAS</text>
    <text x="120" y="150" font-family="Arial" font-size="15" font-weight="600" fill="white">ðŸª™ ${player.coins}</text>

    <text x="240" y="134" font-family="Arial" font-size="10" fill="rgba(255,255,255,0.45)" letter-spacing="0.8">PARTIDAS</text>
    <text x="240" y="150" font-family="Arial" font-size="15" font-weight="600" fill="white">ðŸŽ® ${player.matches_played}</text>

    <text x="360" y="134" font-family="Arial" font-size="10" fill="rgba(255,255,255,0.45)" letter-spacing="0.8">VITORIAS</text>
    <text x="360" y="150" font-family="Arial" font-size="15" font-weight="600" fill="white">ðŸ† ${player.matches_won} (${winRate}%)</text>

    <!-- Skin watermark -->
    <text x="490" y="210" text-anchor="end" font-family="Arial" font-size="9" fill="rgba(255,255,255,0.15)">skin: ${player.active_skin}</text>
  </g>

  <defs>
    <linearGradient id="overlay" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0%" stop-color="rgba(0,0,0,0.92)"/>
      <stop offset="65%" stop-color="rgba(0,0,0,0.5)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.15)"/>
    </linearGradient>
  </defs>
</svg>`;
}

function escXml(str) {
  return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export default async function handler(req, res) {
  const discordId = req.query?.id;
  if (!discordId) return res.status(400).send("Missing id");

  const supabase = getSupabase();
  const { data: player, error } = await supabase.from("players").select("*").eq("discord_id", discordId).maybeSingle();
  if (error || !player) return res.status(404).send("Player not found");

  let rank = { tier: "UNRANKED", rank: "", lp: 0 };
  if (player.summoner_id) {
    rank = await getSummonerRank(player.summoner_id);
  }

  const svg = buildSvg(player, rank);
  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
  return res.status(200).send(svg);
}
