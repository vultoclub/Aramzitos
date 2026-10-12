import { InteractionResponseType, InteractionType, verifyKey } from "discord-interactions";
import { supabase } from "../src/supabase.js";
import { getAccountByRiotId, getSummonerByPuuid } from "../src/riot.js";
import { applyMatchReward } from "../src/gamification.js";

export const config = { api: { bodyParser: false } };
const reply = (content, ephemeral = true) => ({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content, ...(ephemeral ? { flags: 64 } : {}) } });

async function readRawBody(req) {
  if (typeof req.body === "string") return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString("utf8");
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");
  const rawBody = await readRawBody(req);
  const signature = req.headers["x-signature-ed25519"];
  const timestamp = req.headers["x-signature-timestamp"];
  const publicKey = process.env.DISCORD_PUBLIC_KEY ?? "58f358ea5e2626d11c37c6d9f5823b2aa1e20d2e6450dcc062e343fa57a96f18";
  if (!signature || !timestamp) {
    return res.status(401).send("Invalid request signature");
  }
  let valid = false;
  try { valid = verifyKey(rawBody, signature, timestamp, publicKey); } catch (e) { console.error("verifyKey error", e); return res.status(401).send("Invalid request signature"); }
  if (!valid) return res.status(401).send("Invalid request signature");
  let interaction;
  try { interaction = JSON.parse(rawBody); } catch { return res.status(400).send("Invalid JSON"); }
  if (interaction.type === InteractionType.PING) return res.status(200).json({ type: InteractionResponseType.PONG });
  try {
    if (interaction.type === InteractionType.APPLICATION_COMMAND) return res.status(200).json(await handleCommand(interaction));
    if (interaction.type === InteractionType.MESSAGE_COMPONENT) return res.status(200).json(await handleComponent(interaction));
  } catch (error) {
    console.error("Interaction failed", error);
    return res.status(200).json(reply("Não consegui concluir o comando. Verifique a configuração e tente novamente."));
  }
  return res.status(400).send("Unsupported interaction type");
}

async function handleCommand(interaction) {
  const { name, options = [] } = interaction.data;
  const discordId = interaction.member?.user?.id ?? interaction.user?.id;
  if (name === "verificar") {
    const gameName = options.find(x => x.name === "game_name")?.value;
    const tagLine = options.find(x => x.name === "tag_line")?.value;
    if (!gameName || !tagLine) return reply("Informe seu Riot ID no formato Nome#TAG.");
    const account = await getAccountByRiotId(gameName, tagLine);
    const iconId = Math.floor(Math.random() * 29) + 1;
    const { error } = await supabase.from("players").upsert({ discord_id: discordId, riot_puuid: account.puuid, riot_id: `${gameName}#${tagLine}`, is_verified: false, pending_icon_id: iconId }, { onConflict: "discord_id" });
    if (error) throw error;
    return { type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: `Mude o ícone do seu perfil do LoL para **${iconId}** e confirme quando estiver pronto.`, flags: 64, components: [{ type: 1, components: [{ type: 2, style: 1, label: "Confirmar ícone", custom_id: "verify_icon" }] }] } };
  }
  if (name === "perfil") {
    const { data: player, error } = await supabase.from("players").select("*").eq("discord_id", discordId).maybeSingle();
    if (error) throw error;
    if (!player) return reply("Ainda não encontrei seu perfil. Use /verificar primeiro.");
    const rate = player.matches_played ? Math.round(player.matches_won * 100 / player.matches_played) : 0;
    return reply(`**Perfil de ${player.riot_id}**\nNível: ${player.level} · XP: ${player.xp}\nMoedas: ${player.coins}\nPartidas: ${player.matches_played} · Vitórias: ${player.matches_won} (${rate}%)`);
  }
  if (name === "top" || name === "ranking") {
    const { data, error } = await supabase.from("players").select("discord_id, riot_id, level, xp, matches_won").eq("is_verified", true).order("level", { ascending: false }).order("xp", { ascending: false }).limit(10);
    if (error) throw error;
    return reply(data?.length ? `**Ranking ARAM**\n${data.map((p, i) => `${i + 1}. ${p.riot_id} — nível ${p.level}, ${p.xp} XP, ${p.matches_won} vitórias`).join("\n")}` : "Ainda não há jogadores verificados no ranking.");
  }
  if (name === "resultado") {
    const matchId = options.find(x => x.name === "match_id")?.value;
    const winningTeam = options.find(x => x.name === "time_vencedor")?.value;
    const { data: match, error } = await supabase.from("matches").select("id,status").eq("id", matchId).maybeSingle();
    if (error) throw error;
    if (!match || match.status === "finalizada") return reply("Partida não encontrada ou já finalizada.");
    const { data: participants, error: pError } = await supabase.from("match_players").select("discord_id,team").eq("match_id", matchId);
    if (pError) throw pError;
    for (const participant of participants ?? []) {
      const { data: player, error: readError } = await supabase.from("players").select("xp,level,coins,matches_played,matches_won").eq("discord_id", participant.discord_id).single();
      if (readError) throw readError;
      const { error: updateError } = await supabase.from("players").update(applyMatchReward(player, participant.team === winningTeam)).eq("discord_id", participant.discord_id);
      if (updateError) throw updateError;
    }
    const { error: finishError } = await supabase.from("matches").update({ status: "finalizada", winner_team: winningTeam }).eq("id", matchId);
    if (finishError) throw finishError;
    return reply(`Resultado registrado. Time **${winningTeam}** venceu e as recompensas foram distribuídas.`, false);
  }
  return reply("Comando ainda não implementado.");
}

async function handleComponent(interaction) {
  if (interaction.data.custom_id !== "verify_icon") return reply("Botão desconhecido.");
  const discordId = interaction.member?.user?.id ?? interaction.user?.id;
  const { data: player, error } = await supabase.from("players").select("riot_puuid,pending_icon_id,is_verified").eq("discord_id", discordId).maybeSingle();
  if (error) throw error;
  if (!player) return reply("Use /verificar antes de confirmar.");
  if (player.is_verified) return reply("Sua conta já está verificada.");
  const summoner = await getSummonerByPuuid(player.riot_puuid);
  if (summoner.profileIconId !== player.pending_icon_id) return reply(`O ícone ainda não corresponde ao desafio (ID ${player.pending_icon_id}). Tente novamente após alterá-lo.`);
  const { error: updateError } = await supabase.from("players").update({ is_verified: true, pending_icon_id: null }).eq("discord_id", discordId);
  if (updateError) throw updateError;
  const roleId = process.env.DISCORD_VERIFIED_ROLE_ID;
  if (roleId && interaction.guild_id && process.env.DISCORD_BOT_TOKEN) {
    const response = await fetch(`https://discord.com/api/v10/guilds/${interaction.guild_id}/members/${discordId}/roles/${roleId}`, { method: "PUT", headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` } });
    if (!response.ok) console.error("Could not assign verified role", response.status);
  }
  return reply("Conta verificada! Bem-vindo ao ARAM de Cartinhas.");
}
