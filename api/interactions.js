import { InteractionResponseType, InteractionType, verifyKey } from "discord-interactions";
import { supabase } from "../src/supabase.js";
import { getAccountByRiotId, getSummonerByPuuid } from "../src/riot.js";
import { applyMatchReward } from "../src/gamification.js";

export const config = { api: { bodyParser: false } };

const reply = (content, ephemeral = true) => ({
  type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
  data: { content, ...(ephemeral ? { flags: 64 } : {}) },
});

const ELO_OPTIONS = [
  { label: "Ferro",        value: "Ferro",        emoji: { name: "âš™ï¸" } },
  { label: "Bronze",       value: "Bronze",       emoji: { name: "ðŸ¥‰" } },
  { label: "Prata",        value: "Prata",        emoji: { name: "ðŸª™" } },
  { label: "Ouro",         value: "Ouro",         emoji: { name: "ðŸ¥‡" } },
  { label: "Platina",      value: "Platina",      emoji: { name: "ðŸ’ " } },
  { label: "Esmeralda",    value: "Esmeralda",    emoji: { name: "ðŸ’š" } },
  { label: "Diamante",     value: "Diamante",     emoji: { name: "ðŸ’Ž" } },
  { label: "Mestre",       value: "Mestre",       emoji: { name: "ðŸ”®" } },
  { label: "Grao-Mestre",  value: "Grao-Mestre",  emoji: { name: "ðŸ”¥" } },
  { label: "Desafiante",   value: "Desafiante",   emoji: { name: "ðŸ‘‘" } },
  { label: "Unranked",     value: "Unranked",     emoji: { name: "â”" } },
];

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
  try { valid = await verifyKey(rawBody, signature, timestamp, publicKey); } catch { return res.status(401).send("Invalid request signature"); }
  if (!valid) return res.status(401).send("Invalid request signature");
  let interaction;
  try { interaction = JSON.parse(rawBody); } catch { return res.status(400).send("Invalid JSON"); }
  if (interaction.type === InteractionType.PING) return res.status(200).json({ type: InteractionResponseType.PONG });
  try {
    if (interaction.type === InteractionType.APPLICATION_COMMAND) return res.status(200).json(await handleCommand(interaction));
    if (interaction.type === InteractionType.MESSAGE_COMPONENT) return res.status(200).json(await handleComponent(interaction));
    if (interaction.type === 5) return res.status(200).json(await handleModal(interaction)); // MODAL_SUBMIT
  } catch (error) {
    console.error("Interaction failed", error);
    return res.status(200).json(reply("Nao consegui concluir o comando. Tente novamente."));
  }
  return res.status(400).send("Unsupported interaction type");
}

async function handleCommand(interaction) {
  const { name, options = [] } = interaction.data;
  const discordId = interaction.member?.user?.id ?? interaction.user?.id;

  // â”€â”€ /setup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Argumentos directos: sem dropdowns, resposta instantanea
  if (name === "setup") {
    const eloOpt  = options.find(x => x.name === "elo")?.value;
    const nickOpt = options.find(x => x.name === "nick")?.value;

    // Se nao passou argumentos, mostra instrucoes
    if (!eloOpt || !nickOpt) {
      return reply(
        "**Como usar /setup:**\n" +
        "`/setup elo:Ouro nick:SeuNome#BR1`\n\n" +
        "**Elos disponiveis:** Ferro, Bronze, Prata, Ouro, Platina, Esmeralda, Diamante, Mestre, Grao-Mestre, Desafiante, Unranked"
      );
    }

    const parts    = nickOpt.trim().split("#");
    const gameName = parts[0]?.trim();
    const tagLine  = parts[1]?.trim() || "BR1";
    if (!gameName) return reply("Riot ID invalido. Use o formato Nome#BR1.");

    let account;
    try {
      account = await getAccountByRiotId(gameName, tagLine);
    } catch {
      return reply(`Nao encontrei a conta **${gameName}#${tagLine}** na Riot. Verifique o nome e tente novamente.`);
    }

    const iconId = Math.floor(Math.random() * 29) + 1;
    const { error } = await supabase.from("players").upsert(
      { discord_id: discordId, riot_puuid: account.puuid, riot_id: `${gameName}#${tagLine}`, is_verified: false, pending_icon_id: iconId, elo: eloOpt },
      { onConflict: "discord_id" }
    );
    if (error) throw error;

    const iconUrl = `https://ddragon.leagueoflegends.com/cdn/14.20.1/img/profileicon/${iconId}.png`;
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [{
          title: "Verificacao de Conta",
          description: `Elo registrado: **${eloOpt}**\nConta encontrada: **${gameName}#${tagLine}**\n\nMude o icone do seu perfil do LoL para o icone abaixo e clique em **Confirmar Icone**.`,
          image: { url: iconUrl },
          color: 0x5865F2,
          footer: { text: `ID do icone: ${iconId}` },
        }],
        flags: 64,
        components: [{ type: 1, components: [{ type: 2, style: 1, label: "Confirmar Icone", custom_id: "verify_icon" }] }],
      },
    };
  }

  // â”€â”€ /perfil â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (name === "perfil") {
    const { data: player, error } = await supabase.from("players").select("*").eq("discord_id", discordId).maybeSingle();
    if (error) throw error;
    if (!player) return reply("Ainda nao encontrei seu perfil. Use /setup primeiro.");
    const rankText = player.elo ?? "Nao definido";
    const rate = player.matches_played ? Math.round((player.matches_won / player.matches_played) * 100) : 0;
    const xpNeeded = player.level * 200;
    const xpPct = Math.min(100, Math.round((player.xp / xpNeeded) * 100));
    const filled = Math.floor(xpPct / 10);
    const bar = "[" + "=".repeat(filled) + "-".repeat(10 - filled) + "]";
    const skinColors = { default: 0x5865F2, shadow: 0xcc0000, gold: 0xFFB800, void: 0x8c00ff, ice: 0x00b4ff };
    const color = skinColors[player.active_skin] ?? skinColors.default;
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [{
          color,
          author: { name: player.riot_id },
          fields: [
            { name: "Nivel & XP", value: `Nivel **${player.level}**\n${bar} ${xpPct}%\n${player.xp} / ${xpNeeded} XP`, inline: true },
            { name: "Economia",   value: `**${player.coins}** moedas`, inline: true },
            { name: "Partidas",   value: `**${player.matches_played}** jogadas\n**${player.matches_won}** vitorias (${rate}%)`, inline: true },
            { name: "Elo",        value: rankText, inline: true },
          ],
          footer: { text: `Skin: ${player.active_skin ?? "default"} | Use /loja para mudar` },
        }],
        flags: 64,
      },
    };
  }

  // â”€â”€ /top â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (name === "top" || name === "ranking") {
    const { data, error } = await supabase.from("players").select("discord_id, riot_id, level, xp, matches_won").eq("is_verified", true).order("level", { ascending: false }).order("xp", { ascending: false }).limit(10);
    if (error) throw error;
    if (!data?.length) return reply("Ainda nao ha jogadores verificados no ranking.");
    const lines = data.map((p, i) => `${i + 1}. **${p.riot_id}** â€” Nivel ${p.level} â€¢ ${p.xp} XP â€¢ ${p.matches_won} vitorias`);
    return reply(`**Ranking ARAM de Cartinhas**\n\n${lines.join("\n")}`);
  }

  // â”€â”€ /loja â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (name === "loja") {
    const { data: items, error } = await supabase.from("shop_items").select("*").eq("is_active", true).order("price");
    if (error) throw error;
    if (!items?.length) return reply("A loja esta vazia no momento.");
    const { data: player } = await supabase.from("players").select("coins, active_skin").eq("discord_id", discordId).maybeSingle();
    const owned = await supabase.from("inventory").select("item_name").eq("discord_id", discordId).eq("item_type", "card_skin");
    const ownedIds = new Set((owned.data ?? []).map(x => x.item_name).concat(["default"]));
    const lines = items.map(item => {
      const have = ownedIds.has(item.id);
      const equipped = player?.active_skin === item.id;
      const status = equipped ? "[Equipada]" : have ? "[Comprada]" : `${item.price} moedas`;
      return `**${item.name}** (${item.id}) â€” ${item.description}\n  ${status}`;
    });
    const coins = player?.coins ?? 0;
    return reply(`**Loja ARAM de Cartinhas** (suas moedas: ${coins})\n\n${lines.join("\n\n")}\n\nUse **/comprar <id>** para comprar.`);
  }

  // â”€â”€ /comprar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (name === "comprar") {
    const itemId = options.find(x => x.name === "item")?.value;
    if (!itemId) return reply("Informe o ID do item. Use /loja para ver os disponiveis.");
    const { data: item, error: itemErr } = await supabase.from("shop_items").select("*").eq("id", itemId).eq("is_active", true).maybeSingle();
    if (itemErr) throw itemErr;
    if (!item) return reply(`Item "${itemId}" nao encontrado. Use /loja para ver os disponiveis.`);
    const { data: player, error: pErr } = await supabase.from("players").select("coins").eq("discord_id", discordId).maybeSingle();
    if (pErr) throw pErr;
    if (!player) return reply("Use /setup primeiro.");
    if (itemId === "default") return reply(`A skin padrao ja e sua. Use /equipar default para equipa-la.`);
    const { data: existing } = await supabase.from("inventory").select("id").eq("discord_id", discordId).eq("item_name", itemId).maybeSingle();
    if (existing) return reply(`Voce ja possui **${item.name}**. Use /equipar ${itemId} para equipa-la.`);
    if (player.coins < item.price) return reply(`Moedas insuficientes. Voce tem ${player.coins} e precisa de ${item.price}.`);
    await supabase.from("inventory").insert({ discord_id: discordId, item_type: item.item_type, item_name: itemId });
    await supabase.from("players").update({ coins: player.coins - item.price }).eq("discord_id", discordId);
    return reply(`Compra realizada! Voce adquiriu **${item.name}** por ${item.price} moedas.\nSaldo restante: ${player.coins - item.price} moedas\n\nUse **/equipar ${itemId}** para equipar.`);
  }

  // â”€â”€ /equipar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (name === "equipar") {
    const itemId = options.find(x => x.name === "item")?.value;
    if (!itemId) return reply("Informe o ID da skin. Use /loja para ver as disponiveis.");
    const { data: player } = await supabase.from("players").select("active_skin").eq("discord_id", discordId).maybeSingle();
    if (!player) return reply("Use /setup primeiro.");
    if (itemId !== "default") {
      const { data: owned } = await supabase.from("inventory").select("id").eq("discord_id", discordId).eq("item_name", itemId).maybeSingle();
      if (!owned) return reply(`Voce nao possui essa skin. Use /comprar ${itemId} primeiro.`);
    }
    await supabase.from("players").update({ active_skin: itemId }).eq("discord_id", discordId);
    return reply(`Skin **${itemId}** equipada! Use /perfil para ver seu novo card.`);
  }

  // â”€â”€ /fila â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (name === "fila") {
    const sub = options.find(x => x.name === "acao")?.value ?? "ver";

    if (sub === "entrar") {
      const { data: player } = await supabase.from("players").select("riot_id, elo, is_verified").eq("discord_id", discordId).maybeSingle();
      if (!player) return reply("Use /setup primeiro.");
      if (!player.is_verified) return reply("Voce precisa verificar sua conta antes de entrar na fila. Use /setup.");
      const { error: qErr } = await supabase.from("queue").upsert({ discord_id: discordId, riot_id: player.riot_id, elo: player.elo }, { onConflict: "discord_id" });
      if (qErr) throw qErr;
      const { data: queue } = await supabase.from("queue").select("discord_id, riot_id, elo").order("entered_at");
      const count = queue?.length ?? 0;
      if (count >= 10) {
        // Sorteia os times
        const shuffled = [...queue].sort(() => Math.random() - 0.5);
        const blue = shuffled.slice(0, 5);
        const red  = shuffled.slice(5, 10);
        // Cria a partida no banco
        const { data: match } = await supabase.from("matches").insert({ status: "em_andamento", captain_discord_id: blue[0].discord_id }).select().single();
        if (match) {
          const entries = [
            ...blue.map(p => ({ match_id: match.id, discord_id: p.discord_id, team: "blue" })),
            ...red.map(p => ({ match_id: match.id, discord_id: p.discord_id, team: "red" })),
          ];
          await supabase.from("match_players").insert(entries);
          await supabase.from("queue").delete().in("discord_id", shuffled.map(p => p.discord_id));
        }
        const blueNames = blue.map((p, i) => `${i === 0 ? "**[CAP]** " : ""}${p.riot_id}${p.elo ? ` (${p.elo})` : ""}`).join("\n");
        const redNames  = red.map((p, i) => `${i === 0 ? "**[CAP]** " : ""}${p.riot_id}${p.elo ? ` (${p.elo})` : ""}`).join("\n");
        return {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            embeds: [{
              title: "Partida encontrada!",
              color: 0x00ff88,
              fields: [
                { name: "Time Azul", value: blueNames, inline: true },
                { name: "Time Vermelho", value: redNames, inline: true },
              ],
              footer: { text: match ? `ID da partida: ${match.id}` : "" },
              description: "O capitao de cada time cria a sala no LoL Client.\nApos a partida, use **/resultado** para registrar o vencedor.",
            }],
          },
        };
      }
      return reply(`Voce entrou na fila! (${count}/10)\nUse **/fila ver** para ver quem esta esperando.`);
    }

    if (sub === "sair") {
      const { error } = await supabase.from("queue").delete().eq("discord_id", discordId);
      if (error) throw error;
      return reply("Voce saiu da fila.");
    }

    // ver (default)
    const { data: queue } = await supabase.from("queue").select("riot_id, elo").order("entered_at");
    if (!queue?.length) return reply("A fila esta vazia. Use **/fila entrar** para ser o primeiro!");
    const lines = queue.map((p, i) => `${i + 1}. **${p.riot_id}**${p.elo ? ` - ${p.elo}` : ""}`);
    return reply(`**Fila ARAM (${queue.length}/10)**\n\n${lines.join("\n")}`);
  }


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
      await supabase.from("players").update(applyMatchReward(player, p.team === winningTeam)).eq("discord_id", p.discord_id);
    }
    await supabase.from("matches").update({ status: "finalizada", winner_team: winningTeam }).eq("id", matchId);
    return reply(`Resultado registrado. Time **${winningTeam}** venceu e as recompensas foram distribuidas.`, false);
  }

  return reply("Comando ainda nao implementado.");
}

async function handleComponent(interaction) {
  const discordId = interaction.member?.user?.id ?? interaction.user?.id;
  const customId  = interaction.data.custom_id;

  // â”€â”€ Setup passo 1: escolheu o elo, pede o nick via modal â”€â”€â”€â”€â”€
  if (customId === "setup_elo") {
    const elo = interaction.data.values?.[0];
    if (!elo) return reply("Selecione um elo.");

    // Salva elo temporariamente no Supabase (upsert sem riot_id ainda)
    // Usamos um campo de estado temporÃ¡rio via custom_id no modal
    return {
      type: 9, // MODAL
      data: {
        custom_id: `setup_nick:${elo}`,
        title: "Configuracao do perfil â€” Passo 2/2",
        components: [{
          type: 1,
          components: [{
            type: 4, // TEXT_INPUT
            custom_id: "riot_id",
            label: "Seu Riot ID (Nome#BR1)",
            style: 1,
            placeholder: "Ex: Vulto Club#BR1",
            required: true,
            min_length: 3,
            max_length: 50,
          }],
        }],
      },
    };
  }

  // â”€â”€ Verificar Ã­cone â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (customId === "verify_icon") {
    const { data: player, error } = await supabase.from("players").select("riot_puuid,pending_icon_id,is_verified").eq("discord_id", discordId).maybeSingle();
    if (error) throw error;
    if (!player) return reply("Use /setup antes de confirmar.");
    if (player.is_verified) return reply("Sua conta ja esta verificada.");
    const summoner = await getSummonerByPuuid(player.riot_puuid);
    if (summoner.profileIconId !== player.pending_icon_id) return reply(`O icone ainda nao corresponde (ID ${player.pending_icon_id}). Altere e tente novamente.`);
    await supabase.from("players").update({ is_verified: true, pending_icon_id: null, summoner_id: summoner.id }).eq("discord_id", discordId);
    const roleId = process.env.DISCORD_VERIFIED_ROLE_ID;
    if (roleId && interaction.guild_id && process.env.DISCORD_BOT_TOKEN) {
      await fetch(`https://discord.com/api/v10/guilds/${interaction.guild_id}/members/${discordId}/roles/${roleId}`, { method: "PUT", headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` } });
    }
    return reply("Conta verificada! Bem-vindo ao ARAM de Cartinhas. Use /perfil para ver seu card.");
  }

  return reply("Acao desconhecida.");
}

async function handleModal(interaction) {
  const discordId = interaction.member?.user?.id ?? interaction.user?.id;
  const customId  = interaction.data.custom_id ?? "";

  // â”€â”€ Setup passo 2: recebeu o nick, verifica na Riot e pede icone
  if (customId.startsWith("setup_nick:")) {
    const elo      = customId.split(":")[1];
    const riotRaw  = interaction.data.components?.[0]?.components?.[0]?.value ?? "";
    const parts    = riotRaw.trim().split("#");
    const gameName = parts[0]?.trim();
    const tagLine  = (parts[1]?.trim() || "BR1");

    if (!gameName) return reply("Riot ID invalido. Use o formato Nome#BR1.");

    let account;
    try {
      account = await getAccountByRiotId(gameName, tagLine);
    } catch (e) {
      return reply(`Nao encontrei a conta **${gameName}#${tagLine}** na Riot. Verifique o nome e tente novamente.`);
    }

    const iconId = Math.floor(Math.random() * 29) + 1;
    const { error } = await supabase.from("players").upsert(
      { discord_id: discordId, riot_puuid: account.puuid, riot_id: `${gameName}#${tagLine}`, is_verified: false, pending_icon_id: iconId, elo },
      { onConflict: "discord_id" }
    );
    if (error) throw error;

    const iconUrl = `https://ddragon.leagueoflegends.com/cdn/14.20.1/img/profileicon/${iconId}.png`;
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [{
          title: "Verificacao de Conta â€” Ultimo passo!",
          description: `Elo registrado: **${elo}**\nConta encontrada: **${gameName}#${tagLine}**\n\nAgora mude o icone do seu perfil do LoL para o icone abaixo e clique em **Confirmar Icone**.`,
          thumbnail: { url: iconUrl },
          color: 0x5865F2,
          footer: { text: `ID do icone: ${iconId}` },
        }],
        flags: 64,
        components: [{ type: 1, components: [{ type: 2, style: 1, label: "Confirmar Icone", custom_id: "verify_icon" }] }],
      },
    };
  }

  return reply("Acao desconhecida.");
}
