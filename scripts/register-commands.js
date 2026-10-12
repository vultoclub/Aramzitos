const commands = [
  {
    name: "verificar",
    description: "Verifique sua conta de League of Legends",
    options: [
      { name: "game_name", description: "Nome Riot", type: 3, required: true },
      { name: "tag_line",  description: "Tag Riot sem #", type: 3, required: true },
    ],
  },
  { name: "perfil",   description: "Veja seu card de perfil com stats e elo" },
  { name: "top",      description: "Veja o ranking de jogadores" },
  { name: "loja",     description: "Veja os itens disponÃ­veis na loja" },
  {
    name: "comprar",
    description: "Compre um item da loja com suas moedas",
    options: [{ name: "item", description: "ID do item (veja /loja)", type: 3, required: true }],
  },
  {
    name: "equipar",
    description: "Equipe uma skin de card que voce possui",
    options: [{ name: "item", description: "ID da skin (veja /loja)", type: 3, required: true }],
  },
  { name: "setup",    description: "Configura os canais e cargos do servidor ARAM de Cartinhas" },
  {
    name: "resultado",
    description: "Registre o resultado de uma partida",
    options: [
      { name: "match_id",      description: "ID UUID da partida", type: 3, required: true },
      { name: "time_vencedor", description: "Time vencedor",      type: 3, required: true, choices: [{ name: "Azul", value: "blue" }, { name: "Vermelho", value: "red" }] },
    ],
  },
];

const { DISCORD_APPLICATION_ID: appId, DISCORD_BOT_TOKEN: token, DISCORD_GUILD_ID: guildId } = process.env;
if (!appId || !token) throw new Error("Set DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN");
const route   = guildId ? `guilds/${guildId}/commands` : "commands";
const response = await fetch(`https://discord.com/api/v10/applications/${appId}/${route}`, {
  method:  "PUT",
  headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
  body:    JSON.stringify(commands),
});
if (!response.ok) throw new Error(`Discord command registration failed: ${response.status} ${await response.text()}`);
console.log(`Registered ${commands.length} Discord commands.`);
