# ConfiguraÃ§Ã£o do LCU Server (Lobby AutomÃ¡tico)

Este guia explica como configurar o PC para criar lobbies no LoL automaticamente
quando uma partida Ã© formada no servidor Discord.

## Como funciona

```
Fila completa (10 jogadores)
    â†“
Bot Discord (Vercel) envia pedido POST para o teu PC
    â†“
lcu-server.js recebe o pedido e chama a LCU API local
    â†“
LoL Client cria o lobby e convida os jogadores
```

## PrÃ©-requisitos

- Node.js instalado (https://nodejs.org)
- ngrok instalado (https://ngrok.com/download)
- LoL Client aberto e logado com uma conta dedicada

---

## Passo 1 â€” Instalar dependÃªncias

O `lcu-server.js` nÃ£o precisa de dependÃªncias extra â€” usa sÃ³ Node.js puro.

---

## Passo 2 â€” Correr o servidor LCU

Abre um terminal e corre:

```powershell
cd C:\repo2\Aramzitos
node lcu-server.js
```

Deves ver:

```
Aramzitos LCU Server a correr na porta 7373
Secret: aramzitos-secret
```

> Para usar um secret personalizado:
> ```powershell
> $env:LCU_SECRET="o-teu-secret-aqui"; node lcu-server.js
> ```

---

## Passo 3 â€” Expor com ngrok

Noutro terminal:

```powershell
ngrok http 7373
```

O ngrok vai mostrar algo como:

```
Forwarding  https://xxxx-xx-xx-xxx-xx.ngrok-free.app -> http://localhost:7373
```

Copia a URL HTTPS.

---

## Passo 4 â€” Configurar na Vercel

Vai Ã  Vercel â†’ **Settings â†’ Environment Variables** e adiciona:

| Key | Value |
|-----|-------|
| `LOBBY_URL` | `https://xxxx-xx-xx-xxx-xx.ngrok-free.app` |
| `LOBBY_SECRET` | `aramzitos-secret` (ou o teu secret personalizado) |

Depois faz **Redeploy** na Vercel.

---

## Passo 5 â€” Testar

Com o servidor LCU a correr e o ngrok activo, quando 10 jogadores entrarem na
fila `/fila entrar`, o bot vai:

1. Dividir os times automaticamente
2. Chamar o teu PC via ngrok
3. O `lcu-server.js` vai criar o lobby no LoL Client
4. Convidar todos os jogadores automaticamente
5. O painel da partida no Discord vai mostrar **"Lobby criado automaticamente!"**

Se o PC nÃ£o responder (ngrok offline ou servidor parado), o bot continua a
funcionar normalmente â€” apenas mostra o nome e senha da sala para o capitÃ£o
criar manualmente.

---

## Manter o servidor sempre activo (opcional)

Para nÃ£o teres de correr o servidor manualmente sempre, podes usar o PM2:

```powershell
npm install -g pm2
pm2 start lcu-server.js --name aramzitos-lcu
pm2 save
pm2 startup
```

Para o ngrok ficar sempre activo, considera a conta gratuita do ngrok que
permite um tÃºnel estÃ¡tico (sempre o mesmo URL).

---

## Notas

- O LoL Client tem de estar aberto e logado para o servidor funcionar
- A conta logada vai aparecer como criadora do lobby
- Os convites vÃ£o para o nome do summoner de cada jogador (sem a tag #BR1)
- Se um jogador mudou de nick recentemente, o convite pode falhar â€” nesse caso
  ele entra manualmente com o nome e senha da sala
