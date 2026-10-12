# ARAM de Cartinhas — bot para Discord

Base inicial de um bot de Discord por Interactions HTTP, hospedável na Vercel e com dados no Supabase.

## Preparação

1. Crie um projeto Supabase e execute [`supabase/schema.sql`](supabase/schema.sql) no SQL Editor.
2. Copie `.env.example` para `.env` e preencha as credenciais. Use a **service role key** apenas como variável de servidor na Vercel/local; nunca a publique no cliente.
3. Configure `DISCORD_PUBLIC_KEY`, `DISCORD_APPLICATION_ID`, `DISCORD_BOT_TOKEN` e, para atribuir cargo, `DISCORD_VERIFIED_ROLE_ID`. O bot precisa da permissão Manage Roles e o cargo dele deve ficar acima do cargo concedido.
4. Configure `RIOT_API_KEY` e `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`.
5. Instale dependências com `npm install` e rode `npm run dev` para desenvolvimento local via Vercel.
6. Publique na Vercel e defina o endpoint de interações como `https://SEU-DOMINIO/api/interactions` no Discord Developer Portal. O endpoint valida as assinaturas e responde ao PING do Discord.
7. Registre os comandos com `npm run register` (defina `DISCORD_APPLICATION_ID`, `DISCORD_BOT_TOKEN` e opcionalmente `DISCORD_GUILD_ID` para registro rápido no servidor de teste).

## Comandos implementados

- `/verificar game_name tag_line`: inicia o desafio de ícone da Riot e apresenta botão de confirmação.
- `/perfil`: mostra nível, XP, moedas e estatísticas.
- `/top`: ranking dos jogadores verificados.
- `/resultado match_id time_vencedor`: distribui XP/moedas aos participantes gravados em uma partida.

Os comandos `/procurar-partida`, `/loja` e `/comprar` ainda não foram implementados. O registro e o lobby de partidas também ainda são manuais via banco. As chamadas Riot usam `americas` por padrão; ajuste `src/riot.js` caso sua região de conta/plataforma seja diferente.

## Segurança e operação

- O endpoint depende do corpo HTTP bruto para validar assinaturas do Discord.
- Use somente a chave Supabase de servidor nas variáveis de ambiente privadas da Vercel.
- Restrinja `/resultado` aos moderadores antes de abrir o bot ao público. A versão inicial não aplica essa autorização e atualiza participantes em chamadas separadas, portanto é adequada apenas a teste controlado.
- Proteja o endpoint de administração de resultados, monitore limites da Riot e não compartilhe tokens.
