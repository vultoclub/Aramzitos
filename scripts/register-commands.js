const commands = [
  {
    name: "setup",
    description: "Configure seu perfil: elo e conta do LoL",
    options: [
      {
        name: "elo",
        description: "Seu elo atual no LoL",
        type: 3,
        required: true,
        choices: [
          { name: "Ferro",       value: "Ferro" },
          { name: "Bronze",      value: "Bronze" },
          { name: "Prata",       value: "Prata" },
          { name: "Ouro",        value: "Ouro" },
          { name: "Platina",     value: "Platina" },
          { name: "Esmeralda",   value: "Esmeralda" },
          { name: "Diamante",    value: "Diamante" },
          { name: "Mestre",      value: "Mestre" },
          { name: "Grao-Mestre", value: "Grao-Mestre" },
          { name: "Desafiante",  value: "Desafiante" },
          { name: "Unranked",    value: "Unranked" },
        ],
      },
      {
        name: "nick",
        description: "Seu Riot ID (ex: VultoClub#BR1)",
        type: 3,
        required: true,
      },
    ],
  },
  {
    name: "perfil",
    description: "Veja seu card de perfil com stats e elo",
  },
  {
    name: "top",
    description: "Veja o ranking de jogadores",
  },
  {
    name: "loja",
    description: "Veja os itens disponÃ­veis na loja",
  },
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
  {
    name: "fila",
    description: "Gerencie sua posicao na fila ARAM",
    options: [{
      name: "acao",
      description: "O que fazer",
      type: 3,
      required: false,
      choices: [
        { name: "Entrar na fila", value: "entrar" },
        { name: "Sair da fila",   value: "sair" },
        { name: "Ver a fila",     value: "ver" },
      ],
    }],
  },

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
