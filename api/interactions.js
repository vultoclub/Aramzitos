import { InteractionResponseType, InteractionType, verifyKey } from "discord-interactions";
import { supabase } from "../src/supabase.js";
import { getAccountByRiotId, getSummonerByPuuid, getSummonerRank, rankEmoji } from "../src/riot.js";
import { applyMatchReward } from "../src/gamification.js";

export const config = { api: { bodyParser: false } };

const CARD_BASE_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "https://aramzitos.vercel.app";

const reply = (content, ephemeral = true) => ({
  type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
  data: { content, ...(ephemeral ? { flags: 64 } : {}) },
});

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
  if (!signature || !timestamp) return res.status(401).send("Invalid request signature");
  let valid = false;
  try { valid = await verifyKey(rawBody, signature, timestamp, publicKey); } catch (e) { return res.status(401).send("Invalid request signature"); }
  if (!valid) return res.status(401).send("Invalid request signature");
  let interaction;
  try { interaction = JSON.parse(rawBody); } catch { return res.status(400).send("Invalid JSON"); }
  if (interaction.type === InteractionType.PING) return res.status(200).json({ type: InteractionResponseType.PONG });
  try {
    if (interaction.type === InteractionType.APPLICATION_COMMAND) return res.status(200).json(await handleCommand(interaction));
    if (interaction.type === InteractionType.MESSAGE_COMPONENT) return res.status(200).json(await handleComponent(interaction));
  } catch (error) {
    console.error("Interaction failed", error);
    return res.status(200).json(reply("Nao consegui concluir o comando. Tente novamente."));
  }
  return res.status(400).send("Unsupported interaction type");
}

async function handleCommand(interaction) {
  const { name, options = [] } = interaction.data;
  const discordId = interaction.member?.user?.id ?? interaction.user?.id;

  // â”€â”€ /verificar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (name === "verificar") {
    const gameName = options.find(x => x.name === "game_name")?.value;
    const tagLine  = options.find(x => x.name === "tag_line")?.value;
    if (!gameName || !tagLine) return reply("Informe seu Riot ID no formato Nome#TAG.");
    const account = await getAccountByRiotId(gameName, tagLine);
    const iconId  = Math.floor(Math.random() * 29) + 1;
    const { error } = await supabase.from("players").upsert(
      { discord_id: discordId, riot_puuid: account.puuid, riot_id: `${gameName}#${tagLine}`, is_verified: false, pending_icon_id: iconId },
      { onConflict: "discord_id" }
    );
    if (error) throw error;
    const iconUrl = `https://ddragon.leagueoflegends.com/cdn/14.20.1/img/profileicon/${iconId}.png`;
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [{ title: "Verificacao de Conta", description: `Mude o icone do seu perfil do LoL para o icone abaixo e clique em **Confirmar Icone**.`, thumbnail: { url: iconUrl }, color: 0x5865F2, footer: { text: `ID do icone: ${iconId}` } }],
        flags: 64,
        components: [{ type: 1, components: [{ type: 2, style: 1, label: "Confirmar Icone", custom_id: "verify_icon" }] }],
      },
    };
  }

  // â”€â”€ /perfil â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (name === "perfil") {
    // Responde imediatamente para evitar timeout do Discord (3s)
    // Depois edita a mensagem com os dados reais via REST
    const appId = process.env.DISCORD_APPLICATION_ID ?? "1559142578618630144";
    const botToken = process.env.DISCORD_BOT_TOKEN;
    // Dispara o fetch dos dados em background e edita a resposta
    const interactionToken = interaction.token;
    // NÃ£o podemos usar await aqui pois precisamos retornar antes dos 3s
    // Usamos .then() para processar em background
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 25000));
    Promise.race([
      supabase.from("players").select("*").eq("discord_id", discordId).maybeSingle(),
      timeout,
    ]).then(async ({ data: player, error }) => {
      let embed;
      if (error || !player) {
        embed = { description: "Ainda nao encontrei seu perfil. Use /verificar primeiro.", color: 0xcc0000 };
      } else {
        const rate = player.matches_played ? Math.round((player.matches_won / player.matches_played) * 100) : 0;
        const xpNeeded = player.level * 200;
        const xpPct = Math.min(100, Math.round((player.xp / xpNeeded) * 100));
        const bar = "â–ˆ".repeat(Math.floor(xpPct / 10)) + "â–‘".repeat(10 - Math.floor(xpPct / 10));
        const skinColors = { default: 0x5865F2, shadow: 0xcc0000, gold: 0xFFB800, void: 0x8c00ff, ice: 0x00b4ff };
        const color = skinColors[player.active_skin] ?? skinColors.default;
        embed = {
          color,
          author: { name: player.riot_id },
          fields: [
            { name: "Nivel & XP", value: `Nivel **${player.level}**\n${bar} ${xpPct}%\n${player.xp} / ${xpNeeded} XP`, inline: true },
            { name: "Economia", value: `ðŸª™ **${player.coins}** moedas`, inline: true },
            { name: "Partidas", value: `ðŸŽ® **${player.matches_played}** jogadas\nðŸ† **${player.matches_won}** vitorias (${rate}%)`, inline: true },
          ],
          footer: { text: `Skin: ${player.active_skin} | Use /loja para mudar` },
        };
      }
      await fetch(`https://discord.com/api/v10/webhooks/${appId}/${interactionToken}/messages/@original`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embeds: [embed] }),
      });
    }).catch(async (err) => {
      const msg = err.message === "timeout"
        ? "Demorou demais para carregar. Tente novamente."
        : "Erro ao carregar perfil. Tente novamente.";
      await fetch(`https://discord.com/api/v10/webhooks/${appId}/${interactionToken}/messages/@original`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: msg }),
      });
    });

    // Resposta imediata â€” o Discord aceita e espera a ediÃ§Ã£o
    return {
      type: 5, // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
      data: { flags: 64 },
    };
  }

  // â”€â”€ /top â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (name === "top" || name === "ranking") {
    const { data, error } = await supabase.from("players").select("discord_id, riot_id, level, xp, matches_won").eq("is_verified", true).order("level", { ascending: false }).order("xp", { ascending: false }).limit(10);
    if (error) throw error;
    if (!data?.length) return reply("Ainda nao ha jogadores verificados no ranking.");
    const medals = ["ðŸ¥‡", "ðŸ¥ˆ", "ðŸ¥‰"];
    const lines = data.map((p, i) => `${medals[i] ?? `${i + 1}.`} **${p.riot_id}** â€” Nivel ${p.level} â€¢ ${p.xp} XP â€¢ ${p.matches_won} vitorias`);
    return reply(`**Ranking ARAM de Cartinhas**\n\n${lines.join("\n")}`);
  }

  // â”€â”€ /loja â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (name === "loja") {
    const { data: items, error } = await supabase.from("shop_items").select("*").eq("is_active", true).order("price");
    if (error) throw error;
    if (!items?.length) return reply("A loja esta vazia no momento.");
    const { data: player } = await supabase.from("players").select("coins, active_skin").eq("discord_id", discordId).maybeSingle();
    const owned = player ? await supabase.from("inventory").select("item_name").eq("discord_id", discordId).eq("item_type", "card_skin") : { data: [] };
    const ownedIds = new Set((owned.data ?? []).map(x => x.item_name).concat(["default"]));
    const lines = items.map(item => {
      const have = ownedIds.has(item.id);
      const equipped = player?.active_skin === item.id;
      const status = equipped ? "âœ… Equipada" : have ? "âœ” Comprada" : `ðŸª™ ${item.price}`;
      return `**${item.name}** â€” ${item.description}\n  ${status}`;
    });
    const coins = player?.coins ?? 0;
    return reply(`**Loja ARAM de Cartinhas** (suas moedas: ðŸª™ ${coins})\n\n${lines.join("\n\n")}\n\nUse **/comprar <id>** para comprar. IDs: ${items.map(i => `\`${i.id}\``).join(", ")}`);
  }

  // â”€â”€ /comprar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (name === "comprar") {
    const itemId = options.find(x => x.name === "item")?.value;
    if (!itemId) return reply("Informe o ID do item. Use /loja para ver os disponiveis.");
    const { data: item, error: itemErr } = await supabase.from("shop_items").select("*").eq("id", itemId).eq("is_active", true).maybeSingle();
    if (itemErr) throw itemErr;
    if (!item) return reply(`Item \`${itemId}\` nao encontrado. Use /loja para ver os disponiveis.`);
    const { data: player, error: pErr } = await supabase.from("players").select("coins, discord_id").eq("discord_id", discordId).maybeSingle();
    if (pErr) throw pErr;
    if (!player) return reply("Use /verificar primeiro.");
    const { data: existing } = await supabase.from("inventory").select("id").eq("discord_id", discordId).eq("item_name", itemId).maybeSingle();
    if (existing || itemId === "default") return reply(`Voce ja possui **${item.name}**. Use /equipar ${itemId} para equipa-la.`);
    if (player.coins < item.price) return reply(`Moedas insuficientes. Voce tem ðŸª™ ${player.coins} e precisa de ðŸª™ ${item.price}.`);
    const { error: invErr } = await supabase.from("inventory").insert({ discord_id: discordId, item_type: item.item_type, item_name: itemId });
    if (invErr) throw invErr;
    const { error: coinsErr } = await supabase.from("players").update({ coins: player.coins - item.price }).eq("discord_id", discordId);
    if (coinsErr) throw coinsErr;
    return reply(`Compra realizada! Voce adquiriu **${item.name}** por ðŸª™ ${item.price}.\nSaldo restante: ðŸª™ ${player.coins - item.price}\n\nUse **/equipar ${itemId}** para equipar.`);
  }

  // â”€â”€ /equipar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (name === "equipar") {
    const itemId = options.find(x => x.name === "item")?.value;
    if (!itemId) return reply("Informe o ID da skin. Use /loja para ver as disponiveis.");
    const { data: player } = await supabase.from("players").select("active_skin").eq("discord_id", discordId).maybeSingle();
    if (!player) return reply("Use /verificar primeiro.");
    if (itemId !== "default") {
      const { data: owned } = await supabase.from("inventory").select("id").eq("discord_id", discordId).eq("item_name", itemId).maybeSingle();
      if (!owned) return reply(`Voce nao possui essa skin. Use /comprar ${itemId} primeiro.`);
    }
    const { error } = await supabase.from("players").update({ active_skin: itemId }).eq("discord_id", discordId);
    if (error) throw error;
    return reply(`Skin **${itemId}** equipada! Use /perfil para ver seu novo card.`);
  }

  // â”€â”€ /setup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (name === "setup") {
    const guildId  = interaction.guild_id;
    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (!guildId || !botToken) return reply("Comando disponivel apenas em servidores.");
    const headers  = { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" };
    const apiBase  = "https://discord.com/api/v10";
    const roles = [
      { name: "Verificado",       color: 0x3498DB, hoist: true },
      { name: "Mestre do ARAM",   color: 0xF1C40F, hoist: true },
      { name: "Lenda das Cartas", color: 0xE74C3C, hoist: true },
    ];
    for (const role of roles) {
      await fetch(`${apiBase}/guilds/${guildId}/roles`, { method: "POST", headers, body: JSON.stringify(role) });
    }
    const catRes = await fetch(`${apiBase}/guilds/${guildId}/channels`, { method: "POST", headers, body: JSON.stringify({ name: "ARAM DE CARTINHAS", type: 4 }) });
    const cat    = await catRes.json();
    const channels = [
      { name: "boas-vindas",  type: 0, topic: "Bem-vindo ao ARAM de Cartinhas!" },
      { name: "verificacao",  type: 0, topic: "Use /verificar para vincular sua conta do LoL" },
      { name: "fila-aram",    type: 0, topic: "Use /fila para entrar na fila" },
      { name: "resultados",   type: 0, topic: "Resultados das partidas" },
      { name: "ranking",      type: 0, topic: "Use /top para ver o ranking" },
    ];
    for (const ch of channels) {
      await fetch(`${apiBase}/guilds/${guildId}/channels`, { method: "POST", headers, body: JSON.stringify({ ...ch, parent_id: cat.id }) });
    }
    return reply("Servidor configurado! Canais e cargos criados.", false);
  }

  // â”€â”€ /resultado â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (name === "resultado") {
    const matchId     = options.find(x => x.name === "match_id")?.value;
    const winningTeam = options.find(x => x.name === "time_vencedor")?.value;
    const { data: match, error } = await supabase.from("matches").select("id,status").eq("id", matchId).maybeSingle();
    if (error) throw error;
    if (!match || match.status === "finalizada") return reply("Partida nao encontrada ou ja finalizada.");
    const { data: participants, error: pError } = await supabase.from("match_players").select("discord_id,team").eq("match_id", matchId);
    if (pError) throw pError;
    for (const p of participants ?? []) {
      const { data: player, error: rErr } = await supabase.from("players").select("xp,level,coins,matches_played,matches_won").eq("discord_id", p.discord_id).single();
      if (rErr) throw rErr;
      const { error: uErr } = await supabase.from("players").update(applyMatchReward(player, p.team === winningTeam)).eq("discord_id", p.discord_id);
      if (uErr) throw uErr;
    }
    const { error: fErr } = await supabase.from("matches").update({ status: "finalizada", winner_team: winningTeam }).eq("id", matchId);
    if (fErr) throw fErr;
    return reply(`Resultado registrado. Time **${winningTeam}** venceu e as recompensas foram distribuidas.`, false);
  }

  return reply("Comando ainda nao implementado.");
}

async function handleComponent(interaction) {
  if (interaction.data.custom_id !== "verify_icon") return reply("Botao desconhecido.");
  const discordId = interaction.member?.user?.id ?? interaction.user?.id;
  const { data: player, error } = await supabase.from("players").select("riot_puuid,pending_icon_id,is_verified").eq("discord_id", discordId).maybeSingle();
  if (error) throw error;
  if (!player) return reply("Use /verificar antes de confirmar.");
  if (player.is_verified) return reply("Sua conta ja esta verificada.");
  const summoner = await getSummonerByPuuid(player.riot_puuid);
  if (summoner.profileIconId !== player.pending_icon_id) return reply(`O icone ainda nao corresponde (ID ${player.pending_icon_id}). Altere e tente novamente.`);
  // Salva summoner_id para buscar elo depois
  const { error: uErr } = await supabase.from("players").update({ is_verified: true, pending_icon_id: null, summoner_id: summoner.id }).eq("discord_id", discordId);
  if (uErr) throw uErr;
  const roleId = process.env.DISCORD_VERIFIED_ROLE_ID;
  if (roleId && interaction.guild_id && process.env.DISCORD_BOT_TOKEN) {
    await fetch(`https://discord.com/api/v10/guilds/${interaction.guild_id}/members/${discordId}/roles/${roleId}`, { method: "PUT", headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` } });
  }
  return reply("Conta verificada! Bem-vindo ao ARAM de Cartinhas.");
}
