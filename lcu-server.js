/**
 * lcu-server.js â€” Servidor local que cria lobbies no LoL via LCU API
 *
 * Como usar:
 * 1. Abre o LoL Client e faz login
 * 2. Corre: node lcu-server.js
 * 3. Abre ngrok: ngrok http 7373
 * 4. Copia a URL do ngrok e cola na variavel LOBBY_URL da Vercel
 *    Ex: LOBBY_URL=https://xxxx.ngrok-free.app
 * 5. Faz redeploy na Vercel
 *
 * O servidor fica a escutar na porta 7373 e cria lobbies automaticamente
 * quando o bot Discord recebe 10 jogadores na fila.
 */

import fs from "fs";
import path from "path";
import https from "https";
import http from "http";
import { execSync } from "child_process";

const PORT = process.env.LCU_PORT ?? 7373;
const SECRET = process.env.LCU_SECRET ?? "aramzitos-secret";

// Encontra o lockfile do LoL Client (Windows)
function findLockfile() {
  const candidates = [
    "C:\\Riot Games\\League of Legends\\lockfile",
    "D:\\Riot Games\\League of Legends\\lockfile",
    process.env.LOL_PATH ? path.join(process.env.LOL_PATH, "lockfile") : null,
  ].filter(Boolean);

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }

  // Tenta encontrar via processo
  try {
    const result = execSync('wmic process where "name=\'LeagueClientUx.exe\'" get ExecutablePath /value', { encoding: "utf8" });
    const match = result.match(/ExecutablePath=(.+)/);
    if (match) {
      const dir = path.dirname(match[1].trim());
      const lf = path.join(dir, "lockfile");
      if (fs.existsSync(lf)) return lf;
    }
  } catch {}

  return null;
}

// Le as credenciais do lockfile
function readLockfile() {
  const lf = findLockfile();
  if (!lf) throw new Error("LoL Client nao encontrado. Certifica-te que o cliente esta aberto.");
  const content = fs.readFileSync(lf, "utf8");
  const [name, pid, port, password, protocol] = content.split(":");
  return { port: parseInt(port), password, protocol };
}

// Faz um pedido autenticado ao LCU
async function lcuRequest(method, endpoint, body) {
  const { port, password, protocol } = readLockfile();
  const auth = Buffer.from(`riot:${password}`).toString("base64");

  return new Promise((resolve, reject) => {
    const options = {
      hostname: "127.0.0.1",
      port,
      path: endpoint,
      method,
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        ...(body ? { "Content-Length": Buffer.byteLength(JSON.stringify(body)) } : {}),
      },
      rejectUnauthorized: false, // LCU usa certificado self-signed
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Cria um lobby ARAM personalizado
async function createLobby(roomName, roomPassword, playerPuuids) {
  // 1. Cria lobby ARAM (queueId 450 = ARAM, mas usamos lobby personalizado)
  const lobbyRes = await lcuRequest("POST", "/lol-lobby/v2/lobby", {
    queueId: -1, // -1 = custom lobby
    customGameLobby: {
      configuration: {
        gameMode: "ARAM",
        gameMutator: "",
        gameServerRegion: "",
        mapId: 12, // Howling Abyss
        mutators: { id: 1 },
        spectatorPolicy: "AllAllowed",
        teamSize: 5,
      },
      lobbyName: roomName,
      lobbyPassword: roomPassword,
    },
    isCustom: true,
  });

  if (lobbyRes.status !== 200) {
    throw new Error(`Falha ao criar lobby: ${JSON.stringify(lobbyRes.body)}`);
  }

  console.log(`Lobby criado: ${roomName}`);

  // 2. Convida os jogadores pelo summonerName via PUUID
  // O LCU aceita convites por summonerName ou accountId
  // Vamos buscar os summoners pelos PUUIDs e convidar
  const invites = playerPuuids.map(puuid => ({ toSummonerName: puuid }));

  // Nota: o LCU convida pelo nome do summoner, nao pelo PUUID
  // O bot deve passar os nomes dos jogadores (riot_id sem a tag)
  for (const invite of invites) {
    try {
      await lcuRequest("POST", "/lol-lobby/v2/lobby/invitations", [invite]);
    } catch (e) {
      console.warn(`Nao foi possivel convidar ${invite.toSummonerName}:`, e.message);
    }
  }

  return lobbyRes.body;
}

// Servidor HTTP que recebe pedidos do bot Vercel
const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") { res.writeHead(200); res.end(); return; }
  if (req.method !== "POST") { res.writeHead(405); res.end("Method not allowed"); return; }

  // Verifica o secret para evitar uso indevido
  const auth = req.headers["authorization"];
  if (auth !== `Bearer ${SECRET}`) {
    res.writeHead(401);
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }

  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", async () => {
    try {
      const { roomName, roomPassword, players } = JSON.parse(body);
      // players = array de riot_id (ex: ["Vulto Club#VULTO", ...])
      // O LCU convida pelo nome do summoner (sem a tag)
      const summonerNames = players.map(p => p.split("#")[0].trim());

      console.log(`Criando lobby: ${roomName} | Jogadores: ${summonerNames.join(", ")}`);
      await createLobby(roomName, roomPassword, summonerNames);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, roomName, roomPassword }));
    } catch (err) {
      console.error("Erro:", err.message);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`\nAramzitos LCU Server a correr na porta ${PORT}`);
  console.log(`Secret: ${SECRET}`);
  console.log(`\nPassos:`);
  console.log(`1. Abre o ngrok: ngrok http ${PORT}`);
  console.log(`2. Copia a URL HTTPS do ngrok`);
  console.log(`3. Adiciona na Vercel: LOBBY_URL=https://xxxx.ngrok-free.app`);
  console.log(`4. Adiciona na Vercel: LOBBY_SECRET=${SECRET}`);
  console.log(`5. Faz redeploy na Vercel\n`);
});
